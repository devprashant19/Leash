import { getAddress, keccak256, encodeAbiParameters, type Address, type Hex } from 'viem';

export const LEASH_EIP712_DOMAIN_TYPE = 'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)';
export const LEASH_OVERRIDE_TYPE = 'LeashOverride(address agent,address target,uint256 value,bytes calldata,uint256 nonce,uint256 deadline)';

export interface LeashOverridePayload {
  agent: Address;
  target: Address;
  value: bigint;
  data: Hex;
  nonce: bigint;
  deadline: bigint;
}

export class LeashEip712Helper {
  static domainSeparator(chainId: bigint, verifyingContract: Address): Hex {
    const verifiedAddr = getAddress(verifyingContract.toLowerCase());
    return keccak256(
      encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }],
        [
          keccak256(Buffer.from(LEASH_EIP712_DOMAIN_TYPE)),
          keccak256(Buffer.from('LeashModule')),
          keccak256(Buffer.from('1.0.0')),
          chainId,
          verifiedAddr,
        ]
      )
    );
  }

  static hashOverride(payload: LeashOverridePayload): Hex {
    const typeHash = keccak256(Buffer.from(LEASH_OVERRIDE_TYPE));
    const dataHash = keccak256(payload.data);
    const agentAddr = getAddress(payload.agent.toLowerCase());
    const targetAddr = getAddress(payload.target.toLowerCase());

    return keccak256(
      encodeAbiParameters(
        [
          { type: 'bytes32' },
          { type: 'address' },
          { type: 'address' },
          { type: 'uint256' },
          { type: 'bytes32' },
          { type: 'uint256' },
          { type: 'uint256' },
        ],
        [typeHash, agentAddr, targetAddr, payload.value, dataHash, payload.nonce, payload.deadline]
      )
    );
  }

  static digest(chainId: bigint, verifyingContract: Address, payload: LeashOverridePayload): Hex {
    const domain = this.domainSeparator(chainId, verifyingContract);
    const structHash = this.hashOverride(payload);

    return keccak256(
      Buffer.concat([
        Buffer.from('1901', 'hex'),
        Buffer.from(domain.slice(2), 'hex'),
        Buffer.from(structHash.slice(2), 'hex'),
      ])
    );
  }
}
