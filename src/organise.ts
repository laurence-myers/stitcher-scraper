import { promises as fs } from "fs";
import * as path from "path";
import { Readable } from "stream";
import * as htmlParser2 from 'htmlparser2';
import { getXmlStreamFromLocalFile } from "./feed";
import NodeID3 from "node-id3";
import got from "got";
import { pipeline, streamIterableToFile } from "./streaming";
import { failure, Result, success } from "./result";

enum ExitCode {
    Okay,
    UnhandledError,
    InvalidArgs
}

interface FeedData {
    feed: {
        genre: string;
        imageUrl: string;
        name: string;
    };
    episodes: Array<{
        description?: string;
        fileName: string;
        title?: string;
        published: string;
        url: string;
    }>;
}

async function streamFeedData(inputStream: Readable): Promise<FeedData> {
    const data: FeedData = {
        feed: {
            genre: '',
            imageUrl: '',
            name: '',
        },
        episodes: []
    };
    let currentEpisode: FeedData['episodes'][number];
    let isTitle = false;
    let isDescription = false;
    let isEpisodes = false;
    let isName = false;
    const parser = new htmlParser2.WritableStream(
        {
            onopentag(name: string, attribs: { [p: string]: string }) {
                if (isEpisodes && name === 'episode' && attribs['url']) {
                    currentEpisode = {
                        fileName: decodeURIComponent(path.basename(new URL(attribs.url).pathname)),
                        published: attribs.published,
                        url: attribs.url,
                    };

                } else if (name === 'title') {
                    isTitle = true;
                } else if (name === 'description') {
                    isDescription = true;
                } else if (name === 'feed') {
                    data.feed.genre = attribs.genre;
                    data.feed.imageUrl = attribs.imageurl;
                } else if (name === 'episodes') {
                    isEpisodes = true;
                } else if (name === 'name') {
                    isName = true;
                }
            },
            onclosetag(name: string) {
                if (name === 'episode') {
                    data.episodes.push(currentEpisode);
                } else if (name === 'title') {
                    isTitle = false;
                } else if (name === 'description') {
                    isDescription = false;
                } else if (name === 'episodes') {
                    isEpisodes = false;
                } else if (name === 'name') {
                    isName = false;
                }
            },
            ontext(text: string) {
                if (currentEpisode !== undefined) {
                    if (isTitle) {
                        currentEpisode.title = text;
                    } else if (isDescription) {
                        currentEpisode.description = text;
                    }
                } else if (isName) {
                    data.feed.name = text;
                }
            }
        },
        {
            decodeEntities: true,
            recognizeCDATA: true
        });
    await pipeline(inputStream, parser);
    return data;
}

async function streamToOutputs(feedId: string) {
    const xmlInputStream = getXmlStreamFromLocalFile(feedId);
    return streamFeedData(xmlInputStream);
}

function downloadImage(imageUrl: string): Promise<Buffer> {
    return got(imageUrl).buffer();
}

const publishedDatePattern = /^([0-9]{4})-([0-9]{2})-([0-9]{2}) ([0-9]{2}):([0-9]{2}):([0-9]{2})$/;

/**
 * Converts "2020-06-28 21:02:39" to:
 * {
 *     year: 2020,
 *     date: '2806',
 *     time: '2102'
 * }
 */
function parsePublishedDate(published: string): { year: number; date: string; time: string } {
    const matches = published.match(publishedDatePattern);
    if (!matches) {
        throw new Error(`Invalid published date: "${published}"`);
    }
    const year = matches[1];
    const month = matches[2];
    const date = matches[3];
    const hour = matches[4];
    const minute = matches[5];
    return {
        year: parseInt(year),
        date: `${date}${month}`,
        time: `${hour}${minute}`
    };
}

async function tagMp3s(mp3RootDir: string, feedData: FeedData) {
    let imageBuffer;
    console.log(`Downloading image from "${feedData.feed.imageUrl}"...`);
    imageBuffer = await downloadImage(feedData.feed.imageUrl);
    console.log(`Tagging ${feedData.episodes.length} episodes...`);
    for (let i = feedData.episodes.length - 1; i > 0; i--) {

        const episode = feedData.episodes[i];
        const mp3FilePath = path.join(mp3RootDir, episode.fileName);
        try {
            // console.log(`Looking for "${mp3FilePath}"...`);
            await fs.access(mp3FilePath);
        } catch (err) {
            // console.warn(`File "${mp3FilePath}" not found or not accessible, skipping.`);
            continue;
        }
        const tags: NodeID3.Tags = {
            album: feedData.feed.name,
            artist: feedData.feed.name,
            comment: episode.description ? {
                language: 'eng',
                text: episode.description
            } : undefined,
            fileUrl: episode.url,
            genre: feedData.feed.genre,
            language: 'eng',
            image: {
                description: 'Feed Thumbnail',
                imageBuffer,
                mime: feedData.feed.imageUrl.toLowerCase().endsWith('.jpg') ? 'image/jpeg' : 'image/png', // will break if non-JPG/PNG thumbnails
                type: {
                    id: 3,
                    name: 'Feed Thumbnail'
                }
            },
            ...parsePublishedDate(episode.published),
            trackNumber: String(feedData.episodes.length - i),
            title: episode.title,
        };

        const ok = NodeID3.write(tags, mp3FilePath);
        if (!ok) {
            console.error(`Failed to write to "${mp3FilePath}: ${ok}"`);
        } else {
            console.log(`Updated file "${mp3FilePath}"`);
        }
    }
}

function sanitiseFileName(name: string): string {
    return name.replace(': ', ' - ')
        .replace(/["]/g,"'")
        .replace(/[<>:/\\|?*]/g,"")
        .trim();
}

async function renameMp3s(mp3RootDir: string, feedData: FeedData) {
    console.log(`Renaming ${feedData.episodes.length} episodes...`);
    const renames: [string, string][] = [];
    for (let i = feedData.episodes.length - 1; i > 0; i--) {
        const episodeNumber = feedData.episodes.length - i;
        const episode = feedData.episodes[i];
        const mp3FilePath = path.join(mp3RootDir, episode.fileName);
        try {
            // console.log(`Looking for "${mp3FilePath}"...`);
            await fs.access(mp3FilePath);
        } catch (err) {
            // console.warn(`File "${mp3FilePath}" not found or not accessible, skipping.`);
            continue;
        }

        try {
            const extension = path.extname(episode.fileName);
            const newFileName = sanitiseFileName([
                feedData.feed.name,
                // episodeNumber,
                episode.published.split(' ')[0],
                (episode.title || String(episodeNumber)).replace(/,([a-zA-Z])/g, ', $1')
            ].join(' - ')) + extension;
            await fs.rename(mp3FilePath, path.join(mp3RootDir, newFileName));
            renames.push([episode.fileName, newFileName]);
            console.log(`Renamed file ${episode.fileName} => ${newFileName}`);
        } catch (err) {
            console.error(`Failed to write to "${mp3FilePath}: ${err}"`);
        }
    }
    await streamIterableToFile(path.join(mp3RootDir, 'renames.tsv'), function* () {
        for (const entry of renames) {
            yield entry[0] + '\t' + entry[1] + '\n';
        }
    }());
}

interface CommandLineArgs {
    directory: string;
    feed: string;
    rename: boolean;
    tag: boolean;
}

async function parseArgs(args: string[]): Promise<Result<string, CommandLineArgs>> {
    let feed: string | undefined;
    let directory: string | undefined;
    const options = {
        tag: false,
        rename: false
    };

    for (const arg of args) {
        if (arg === '--tag') {
            options.tag = true;
        } else if (arg === '--rename') {
            options.rename = true;
        } else {
            if (!feed) {
                if (!/^[0-9]+$/.test(arg)) {
                    return failure(`"${ arg }" does not look like a valid feed ID.`);
                }
                feed = arg;
            } else if (!directory) {
                const stat = await fs.stat(arg)
                if (!stat.isDirectory()) {
                    return failure(`"${ arg }" is not a directory. Please pass the directory containing the download MP3 files as the second argument.`);
                }
                directory = arg;
            } else {
                return failure(`Too many arguments. Please only pass the feed ID and the directory containing the downloaded MP3 files.`);
            }
        }
    }

    if (!options.tag && !options.rename) {
        options.tag = true;
        options.rename = true;
    }

    if (!feed) {
        return failure(`Please pass the feed ID as the first argument.`);
    }
    if (!directory) {
        return failure(`Please pass the directory containing the download MP3 files as the second argument.`);
    }

    return success({
        directory,
        feed,
        ...options
    });
}

async function main(rawArgs: string[]): Promise<ExitCode> {
    const argsR = await parseArgs(rawArgs);
    if (!argsR.success) {
        console.error(argsR.error);
        return ExitCode.InvalidArgs;
    }
    const args = argsR.value;
    const mp3Dir = args.directory;
    const feedData = await streamToOutputs(args.feed);
    if (args.tag) {
        await tagMp3s(mp3Dir, feedData);
    }
    if (args.rename) {
        await renameMp3s(mp3Dir, feedData);
    }
    return ExitCode.Okay;
}

if (require.main == module) {
    main(process.argv.slice(2))
        .then((exitCode) => process.exitCode = exitCode)
        .catch((err) => {
            console.error(err);
            process.exitCode = ExitCode.UnhandledError;
        });
}
