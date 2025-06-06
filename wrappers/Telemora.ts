import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type TelemoraConfig = {
  adminAddress: Address;
  commissionBps: number;
};

export function telemoraConfigToCell(config: TelemoraConfig): Cell {
  return beginCell().storeAddress(config.adminAddress).storeInt(config.commissionBps, 11).endCell();
}

export const Opcodes = {
  admin_withdraw: 0x4cdd6f51,
  payment: 0x1b40800,
};

export class Telemora implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell },
  ) {}

  static createFromAddress(address: Address) {
    return new Telemora(address);
  }

  static createFromConfig(config: TelemoraConfig, code: Cell, workchain = 0) {
    const data = telemoraConfigToCell(config);
    const init = { code, data };
    return new Telemora(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async getBalance(provider: ContractProvider) {
    const result = await provider.getState();
    return Number(result.balance.toString());
  }

  async sendWithdraw(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      senderAddress: Address;
      withdrawAmount: bigint;
      queryID?: number;
    },
  ) {
    const body = beginCell()
      .storeUint(Opcodes.admin_withdraw, 32)
      .storeAddress(opts.senderAddress)
      .storeCoins(opts.withdrawAmount)
      .endCell();

    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      body: body,
    });
  }

  async sendPayment(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      sellerAddress: Address;
      queryID?: number;
    },
  ) {
    const body = beginCell().storeUint(Opcodes.payment, 32).storeAddress(opts.sellerAddress).endCell();

    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      body: body,
    });
  }

  async getAdminAddress(provider: ContractProvider) {
    const result = await provider.get('get_admin_address', []);
    const adminAddress = result.stack.readAddressOpt();
    if (adminAddress) {
      return adminAddress.toString();
    }
    return null;
  }

  async getCommissionPercent(provider: ContractProvider) {
    const result = await provider.get('get_commission_percent', []);
    return result.stack.readNumber();
  }
}
