
import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

const contractName = "content-moderation";

describe("Content Moderation Contract - Basic Setup & Initialization", () => {
  beforeEach(() => {
    simnet.mineEmptyBlocks(1);
  });

  describe("Contract Deployment", () => {
    it("should be properly deployed", () => {
      expect(simnet.blockHeight).toBeDefined();
    });

    it("should initialize with correct constants", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-user-reputation",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result).toStrictEqual(Cl.tuple({ score: Cl.uint(0) }));
    });

    it("should start with content counter at 0", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-content",
        [Cl.uint(1)],
        deployer
      );
      expect(result).toBeNone();
    });
  });

  describe("Content Submission", () => {
    it("should successfully submit content", () => {
      const contentHash = new Uint8Array(32).fill(1);
      const { result } = simnet.callPublicFn(
        contractName,
        "submit-content",
        [Cl.buffer(contentHash)],
        wallet1
      );
      expect(result).toBeOk(Cl.uint(1));
    });

    it("should increment content counter after submission", () => {
      const contentHash1 = new Uint8Array(32).fill(1);
      const contentHash2 = new Uint8Array(32).fill(2);

      const { result: result1 } = simnet.callPublicFn(
        contractName,
        "submit-content",
        [Cl.buffer(contentHash1)],
        wallet1
      );
      expect(result1).toBeOk(Cl.uint(1));

      const { result: result2 } = simnet.callPublicFn(
        contractName,
        "submit-content",
        [Cl.buffer(contentHash2)],
        wallet2
      );
      expect(result2).toBeOk(Cl.uint(2));
    });

    it("should store content with correct initial values", () => {
      const contentHash = new Uint8Array(32).fill(42);
      simnet.callPublicFn(
        contractName,
        "submit-content",
        [Cl.buffer(contentHash)],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-content",
        [Cl.uint(1)],
        deployer
      );

      expect(result).toBeSome(
        Cl.tuple({
          author: Cl.principal(wallet1),
          "content-hash": Cl.buffer(contentHash),
          status: Cl.stringAscii("pending"),
          "created-at": Cl.uint(simnet.blockHeight),
          "votes-for": Cl.uint(0),
          "votes-against": Cl.uint(0),
          "voting-ends-at": Cl.uint(simnet.blockHeight + 144),
        })
      );
    });
  });

  describe("User Reputation System", () => {
    it("should return zero reputation for new users", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-user-reputation",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result).toStrictEqual(Cl.tuple({ score: Cl.uint(0) }));
    });

    it("should track reputation for multiple users", () => {
      const { result: result1 } = simnet.callReadOnlyFn(
        contractName,
        "get-user-reputation",
        [Cl.principal(wallet1)],
        deployer
      );
      const { result: result2 } = simnet.callReadOnlyFn(
        contractName,
        "get-user-reputation",
        [Cl.principal(wallet2)],
        deployer
      );

      expect(result1).toStrictEqual(Cl.tuple({ score: Cl.uint(0) }));
      expect(result2).toStrictEqual(Cl.tuple({ score: Cl.uint(0) }));
    });
  });

  describe("Moderator Stake System Initialization", () => {
    it("should return none for unstaked moderators", () => {
      const { result } = simnet.callReadOnlyFn(
        contractName,
        "get-moderator-stake",
        [Cl.principal(wallet1)],
        deployer
      );
      expect(result).toBeNone();
    });

    it("should fail staking with insufficient amount", () => {
      const { result } = simnet.callPublicFn(
        contractName,
        "stake-tokens",
        [Cl.uint(500)], // Less than MIN_STAKE_AMOUNT (1000)
        wallet1
      );
      expect(result).toBeErr(Cl.uint(5)); // ERR-INVALID-STAKE
    });
  });

  describe("Vote Tracking System", () => {
    it("should return false for users who haven't voted", () => {
      const contentHash = new Uint8Array(32).fill(1);
      simnet.callPublicFn(
        contractName,
        "submit-content",
        [Cl.buffer(contentHash)],
        wallet1
      );

      const { result } = simnet.callReadOnlyFn(
        contractName,
        "has-voted",
        [Cl.uint(1), Cl.principal(wallet2)],
        deployer
      );
      expect(result).toBeBool(false);
    });
  });
});
