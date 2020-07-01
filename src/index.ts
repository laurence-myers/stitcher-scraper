import * as fs from 'fs';
import * as path from "path";
import { Readable } from "stream";
import got from 'got';
import * as htmlParser2 from 'htmlparser2';

enum ExitCode {
    Okay,
    UnhandledError,
    InvalidArgs
}

const defaultOptions = {
    count: 10,
    season: -1,
    offset: 0
};

const feeds = {
    ComedyBangBang: '96916'
};

function getUrl(feed: string, userId: string, options: { count?: number; season?: number; offset?: number } = {}) {
    options = {
        ...defaultOptions,
        ...options
    };
    return `https://app.stitcher.com/Service/GetFeedDetailsWithEpisodes.php?mode=webApp&fid=${feed}&s=${options.offset}&id_Season=${options.season}&uid=${userId}&c=${ options.count }`;
}

function getXmlStream(feedId: string, userId: string) {
    return got.stream(getUrl(
        feedId,
        userId,
        {
            count: 10000,
        }
    ));
}

function streamUrlsToArray(inputStream: Readable): Promise<string[]> {
    return new Promise((resolve, reject) => {
        try {
            const urls: string[] = [];
            const parser = new htmlParser2.WritableStream({
                onopentag(name: string, attribs: { [p: string]: string }) {
                    if (name === 'episode' && attribs['url']) {
                        urls.push(attribs['url']);
                    }
                }
            }, {
                decodeEntities: true
            });

            inputStream.pipe(parser);
            parser.on('finish', () => resolve(urls));
            parser.on('error', (err) => reject(err));
        } catch (err) {
            reject(err);
        }
    });
}

function streamXmlToFile(feedId: string, inputStream: Readable): Promise<void> {
    fs.mkdirSync('feeds', { recursive: true });
    return new Promise((resolve, reject) => {
        try {
            const fileStream = fs.createWriteStream(path.join('feeds', `${feedId}.xml`));
            inputStream.pipe(fileStream);
            fileStream.on('finish', () => resolve());
            fileStream.on('error', (err) => reject(err));
        } catch (err) {
            reject(err);
        }
    });
}

async function streamToOutputs(feedId: string, userId: string) {
    const xmlInputStream = getXmlStream(feedId, userId);
    const urlsP = streamUrlsToArray(xmlInputStream);
    const feedFileP = streamXmlToFile(feedId, xmlInputStream);
    const [urls] = await Promise.all([urlsP, feedFileP]);
    return urls;
}

function logInAscendingOrder(urls: string[]): void {
    for (let i = urls.length - 1; i >= 0; i--) {
        console.log(urls[i]);
    }
}

async function main(args: string[]): Promise<ExitCode> {
    if (args.length !== 1) {
        console.error(`Please pass your Stitcher user ID as the first argument`);
        return ExitCode.InvalidArgs;
    }
    const userId = args[0];
    const urls = await streamToOutputs(feeds.ComedyBangBang, userId);
    logInAscendingOrder(urls);
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
