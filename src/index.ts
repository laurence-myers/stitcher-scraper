import * as fs from 'fs';
import * as path from "path";
import { Readable } from "stream";
import * as htmlParser2 from 'htmlparser2';
import { getXmlStreamFromServer } from "./feed";
import { pipeline, streamIterableToFile } from "./streaming";
import { failure, Result, success } from "./result";

enum ExitCode {
    Okay,
    UnhandledError,
    InvalidArgs
}

async function streamUrlsToArray(inputStream: Readable): Promise<string[]> {
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

    await pipeline(inputStream, parser);
    return urls;
}

async function streamXmlToFile(feedId: string, inputStream: Readable): Promise<void> {
    fs.mkdirSync('feeds', { recursive: true });
    const fileStream = fs.createWriteStream(path.join('feeds', `${feedId}.xml`));
    await pipeline(inputStream, fileStream);
}

async function streamToOutputs(feedId: string, userId: string) {
    const xmlInputStream = getXmlStreamFromServer(feedId, userId);
    const [urls] = await Promise.all([
        streamUrlsToArray(xmlInputStream),
        streamXmlToFile(feedId, xmlInputStream)
    ]);
    return urls;
}

async function writeInAscendingOrder(feedId: string, urls: string[]): Promise<void> {
    await streamIterableToFile(feedId + '.txt', function* () {
        for (let i = urls.length - 1; i >= 0; i--) {
            yield urls[i] + '\n';
        }
    }());
}

interface CommandLineArgs {
    feedId: string;
    userId: string;
}

async function parseArgs(args: string[]): Promise<Result<string, CommandLineArgs>> {
    let feedId: string | undefined;
    let userId: string | undefined;

    for (const arg of args) {
        if (!userId) {
            if (!/^[0-9]+$/.test(arg)) {
                return failure(`"${ arg }" does not look like a valid user ID.`);
            }
            userId = arg;
        } else if (!feedId) {
            if (!/^[0-9]+$/.test(arg)) {
                return failure(`"${ arg }" does not look like a valid feed ID.`);
            }
            feedId = arg;
        } else {
            return failure(`Too many arguments. Please only pass the feed ID and the directory containing the downloaded MP3 files.`);
        }
    }

    if (!userId) {
        return failure(`Please pass your Stitcher user ID as the first argument.`);
    }
    if (!feedId) {
        return failure(`Please pass the feed ID as the second argument.`);
    }

    return success({
        feedId,
        userId
    });
}

async function main(rawArgs: string[]): Promise<ExitCode> {
    const argsR = await parseArgs(rawArgs);
    if (!argsR.success) {
        console.error(argsR.error);
        return ExitCode.InvalidArgs;
    }
    const args = argsR.value;
    const urls = await streamToOutputs(args.feedId, args.userId);
    await writeInAscendingOrder(args.feedId, urls);
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
