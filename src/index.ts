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

function getXmlStream(userId: string) {
    return got.stream(getUrl(
        feeds.ComedyBangBang,
        userId,
        {
            count: 10000,
        }
    ));
}

function streamUrlsToArray(userId: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
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

        getXmlStream(userId).pipe(parser);
        parser.on('finish', () => resolve(urls));
        parser.on('error', (err) => reject(err));
    });
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
    const urls = await streamUrlsToArray(userId);
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
