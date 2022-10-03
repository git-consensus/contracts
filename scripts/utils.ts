import { expect } from "chai";
import {
    BaseContract,
    BigNumber,
    BigNumberish,
    ContractReceipt,
    ContractTransaction,
    utils
} from "ethers";
import { concat, Interface } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { hexlify } from "@ethersproject/bytes";
import { TransactionReceipt } from "@ethersproject/providers";

import { REPORT_GAS } from "../hardhat.config";
import { PromiseOrValue } from "../types/common";
import { ZERO_HASH } from "./const";

// --- Transaction & contract deployment helpers ---

// Wait for a contract to be deployed
export async function deployWait<T extends BaseContract>(contractPromise: Promise<T>): Promise<T> {
    const contract = await contractPromise;
    await contract.deployed();
    return contract;
}

// Submit a transaction and wait for it to be mined. Then assert that it succeeded.
export async function submitTxWait(
    tx: Promise<ContractTransaction>,
    txName = `transaction`,
): Promise<ContractReceipt> {
    void expect(tx).to.not.be.reverted;
    const receipt = await (await tx).wait();
    if (REPORT_GAS) {
        console.log(`Gas used for ` + txName + `: ` + receipt.gasUsed.toString());
    }
    expect(receipt.status).to.eq(1);
    return receipt;
}

// Submit a transaction and expect it to fail. Throws an error if it succeeds.
export async function submitTxFail(
    tx: Promise<ContractTransaction>,
    expectedCause?: string,
): Promise<void> {
    const receipt = tx.then(result => result.wait());
    await expectTxFail(receipt, expectedCause);
}

// Expect a transaction to fail. Throws an error if it succeeds.
export async function expectTxFail<T>(tx: Promise<T>, expectedCause?: string): Promise<void> {
    try {
        await tx;
    } catch (error) {
        if (expectedCause) {
            if (!(error instanceof Error)) {
                throw error;
            }

            // error cleaning
            let cause = error.message.replace(
                `VM Exception while processing transaction: reverted with reason string `,
                ``,
            );
            // custom error specific
            cause = cause.replace(
                `VM Exception while processing transaction: reverted with custom error `,
                ``,
            );
            // custom error specific, e.g. 'MsgNeedsAddr()' error to check for just 'MsgNeedsAddr'
            cause = cause.replace(`()`, ``);
            expect(cause).to.equal(
                `'` + expectedCause + `'`,
                `tx failed as expected, but unexpected reason string`,
            );
        }
        return;
    }
    expect.fail(`expected tx to fail, but it succeeded`);
}

export function parseEvent(
    receipt: TransactionReceipt,
    contractInterface: Interface,
): utils.LogDescription[] {
    const res: utils.LogDescription[] = [];
    for (const log of receipt.logs) {
        let result;
        try {
            result = contractInterface.parseLog(log);
            res.push(result);
        } catch (e) {
            continue;
        }
    }
    return res;
}

// --- EVM Time helpers ---

export const period = {
    seconds: function (val: number): number {
        return val;
    },
    minutes: function (val: number): number {
        return val * this.seconds(60);
    },
    hours: function (val: number): number {
        return val * this.minutes(60);
    },
    days: function (val: number): number {
        return val * this.hours(24);
    },
};

// Wait for N number of blocks with a default 12 second interval in-between.
// ~12 seconds is average after the PoW beacon change, but this still might need
// to be adjusted for certain test cases.
export async function waitBlocks(count: number, seconds: number = 12): Promise<void> {
    const blocks = ethers.utils.hexValue(count).toString();
    const interval = ethers.utils.hexValue(seconds);

    await ethers.provider.send(`hardhat_mine`, [blocks, interval]);
}

// --- Math helpers ---

export const saltToHex = (salt: string | number): string => ethers.utils.id(salt.toString());

// Choosing items randomly until all are taken and only then repeating
// https://stackoverflow.com/a/17891411/15757416
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function randomAvoidRepeats(array: any[]): any {
    let copy = array.slice(0);
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    return function () {
        if (copy.length < 1) {
            copy = array.slice(0);
        }
        const index = Math.floor(Math.random() * copy.length);
        const item: unknown = copy[index];
        copy.splice(index, 1);
        return item;
    };
}

export function randomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// OZ ERC20Votes has `type(uint224).max` check on mint, so must fit into 224 bits (28 bytes)
// but for us this might also be used to generate MULTIPLE distribution values, so really
// play it safe and default to 20.
export function randomBigNumber(bytes = 20): BigNumber {
    // zero-padding left
    return ethers.BigNumber.from(
        hexlify(concat([ethers.utils.randomBytes(bytes), ZERO_HASH]).slice(0, bytes)),
    );
}

// Calculate total sum from all individual values in the array.
export async function sumBigNumbers(values: PromiseOrValue<BigNumberish>[]): Promise<BigNumberish> {
    let sum = ethers.BigNumber.from(0);
    for (const val of values) {
        sum = sum.add(await val);
    }
    return sum;
}

// Mirrors the behavior of the address parsing in the GitConsensus contract.
export function parseAddr(str: string): string {
    return str.slice(indexOfAddr(str));
}

export function indexOfAddr(str: string): number {
    for (let i = str.length - 1; i > 0; --i) {
        if (str[i - 1] == `0` && str[i] == `x`) {
            return i - 1;
        }
    }
    return 0;
}
