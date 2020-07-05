import { createWriteStream } from "fs";
import { pipeline as pipelineOrig, Readable } from "stream";
import { promisify } from "util";

export const pipeline = promisify(pipelineOrig);

export async function streamIterableToFile(filePath: string, source: Iterable<any> | AsyncIterable<any>) {
    const outFile = createWriteStream(filePath);
    await pipeline(Readable.from(source), outFile);
    outFile.close();
}
