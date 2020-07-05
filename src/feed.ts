import got from "got";
import fs from "fs";
import path from "path";

export const feedIds = {
    AnalyzePhish: '32540',
    BonanasForBonanza: '519840',
    ComedyBangBang: '96916',
    ComedyBangBangLiveShows: '463865',
    ConanOBrienNeedsAFriend: '326859',
    EarwolfPackPicks: '345057',
    TheGinoLombardoShow: '474009',
    HelloFromTheMagicTavern: '173481',
    HelloFromTheMagicTavernPresentsEarthGames: '454127',
    HelloFromTheMagicTavernPresentsMastersOfMayhem: '512801',
    HollywoodHandbook: '148037',
    HowDidThisGetMade: '123512',
    HowDidThisGetPlayed: '418438',
    improv4humans: '148038',
    LiveAtUCB: '134424',
    MyBrotherMyBrotherAndMe: '16669',
    MyDeadWifeTheRobotCar: '226051',
    TheNeighbourhoodListen: '463048',
    OffBook: '146253',
    QuestionsForLennon: '122975',
    RUTalkinRHCPREMe: '96905',
    Spontaneanation: '148040',
    StayFHomekins: '514917',
    Superego: '15981',
    SuperegoForgottenClassics: '96876',
    Threedom: '178858',
    VoyageToTheStars: '370190',
    WildHorsesThePerspective: '96897',
    WithSpecialGuestLaurenLapkus: '148032',
    WompItUp: '148041',
};

const defaultOptions = {
    count: 10,
    season: -1,
    offset: 0
};

function getUrl(feed: string, userId: string, options: { count?: number; season?: number; offset?: number } = {}) {
    options = {
        ...defaultOptions,
        ...options
    };
    return `https://app.stitcher.com/Service/GetFeedDetailsWithEpisodes.php?mode=webApp&fid=${feed}&s=${options.offset}&id_Season=${options.season}&uid=${userId}&c=${ options.count }`;
}

export function getXmlStreamFromServer(feedId: string, userId: string) {
    return got.stream(getUrl(
        feedId,
        userId,
        {
            count: 10000,
        }
    ));
}

export function getXmlStreamFromLocalFile(feedId: string) {
    return fs.createReadStream(path.join('feeds', `${feedId}.xml`));
}
