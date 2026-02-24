import { gql } from 'apollo-server';

export const typeDefs = gql`
  scalar DateTime
  scalar Decimal

  type Vault {
    id: ID!
    address: String!
    name: String
    tokenAddress: String!
    ownerAddress: String!
    totalAmount: Decimal!
    createdAt: DateTime!
    updatedAt: DateTime!
    beneficiaries: [Beneficiary!]!
    subSchedules: [SubSchedule!]!
    summary: VaultSummary
  }

  type Beneficiary {
    id: ID!
    vaultId: ID!
    address: String!
    totalAllocated: Decimal!
    totalWithdrawn: Decimal!
    createdAt: DateTime!
    updatedAt: DateTime!
    vault: Vault!
    withdrawableAmount(withdrawableAt: DateTime): WithdrawableInfo!
  }

  type SubSchedule {
    id: ID!
    vaultId: ID!
    topUpAmount: Decimal!
    cliffDuration: Int!
    vestingDuration: Int!
    startTimestamp: DateTime!
    endTimestamp: DateTime!
    amountWithdrawn: Decimal!
    transactionHash: String!
    blockNumber: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    vault: Vault!
  }

  type ClaimsHistory {
    id: ID!
    userAddress: String!
    tokenAddress: String!
    amountClaimed: Decimal!
    claimTimestamp: DateTime!
    transactionHash: String!
    blockNumber: String!
    priceAtClaimUsd: Decimal
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type VaultSummary {
    totalAllocated: Decimal!
    totalWithdrawn: Decimal!
    remainingAmount: Decimal!
    activeBeneficiaries: Int!
    totalBeneficiaries: Int!
  }

  type WithdrawableInfo {
    totalWithdrawable: Decimal!
    vestedAmount: Decimal!
    remainingAmount: Decimal!
    isFullyVested: Boolean!
    nextVestTime: DateTime
  }

  type RealizedGains {
    totalGains: Decimal!
    claims: [ClaimsHistory!]!
    periodStart: DateTime
    periodEnd: DateTime
  }

  type AuditLog {
    id: ID!
    adminAddress: String!
    action: String!
    targetVault: String
    details: String
    timestamp: DateTime!
    transactionHash: String
  }

  type AdminTransfer {
    id: ID!
    currentAdminAddress: String!
    newAdminAddress: String!
    contractAddress: String!
    status: String!
    createdAt: DateTime!
    completedAt: DateTime
  }

  input CreateVaultInput {
    address: String!
    name: String
    tokenAddress: String!
    ownerAddress: String!
    totalAmount: Decimal!
  }

  input TopUpInput {
    vaultAddress: String!
    amount: Decimal!
    cliffDuration: Int!
    vestingDuration: Int!
    transactionHash: String!
    blockNumber: String!
  }

  input WithdrawalInput {
    vaultAddress: String!
    beneficiaryAddress: String!
    amount: Decimal!
    transactionHash: String!
    blockNumber: String!
  }

  input ClaimInput {
    userAddress: String!
    tokenAddress: String!
    amountClaimed: Decimal!
    claimTimestamp: DateTime!
    transactionHash: String!
    blockNumber: String!
  }

  input AdminActionInput {
    adminAddress: String!
    targetVault: String!
    reason: String
  }

  input CreateAdminTransferInput {
    currentAdminAddress: String!
    newAdminAddress: String!
    contractAddress: String!
  }

  input AcceptOwnershipInput {
    newAdminAddress: String!
    transferId: ID!
  }

  type Query {
    # Vault queries
    vault(address: String!): Vault
    vaults(ownerAddress: String, first: Int, after: String): [Vault!]!
    vaultSummary(vaultAddress: String!): VaultSummary
    
    # Beneficiary queries
    beneficiary(vaultAddress: String!, beneficiaryAddress: String!): Beneficiary
    beneficiaries(vaultAddress: String!, first: Int, after: String): [Beneficiary!]!
    
    # Claims queries
    claims(userAddress: String, tokenAddress: String, first: Int, after: String): [ClaimsHistory!]!
    claim(transactionHash: String!): ClaimsHistory
    realizedGains(userAddress: String!, startDate: DateTime, endDate: DateTime): RealizedGains!
    
    # TVL queries
    tvlStats: TVLStats!
    
    # Admin queries
    auditLogs(limit: Int): [AuditLog!]!
    pendingTransfers(contractAddress: String): [AdminTransfer!]!
    
    # Health check
    health: String!
  }

  type Mutation {
    # Vault mutations
    createVault(input: CreateVaultInput!): Vault!
    topUpVault(input: TopUpInput!): SubSchedule!
    
    # Withdrawal mutations
    withdraw(input: WithdrawalInput!): WithdrawalInfo!
    
    # Claims mutations
    processClaim(input: ClaimInput!): ClaimsHistory!
    processBatchClaims(claims: [ClaimInput!]!): [ClaimsHistory!]!
    backfillMissingPrices: Int!
    
    # Admin mutations
    revokeAccess(input: AdminActionInput!): AuditLog!
    createVault(input: CreateVaultInput!): Vault!
    transferVault(input: AdminActionInput!): AuditLog!
    
    # Admin key management
    proposeNewAdmin(input: CreateAdminTransferInput!): AdminTransfer!
    acceptOwnership(input: AcceptOwnershipInput!): AdminTransfer!
    transferOwnership(input: CreateAdminTransferInput!): AdminTransfer!
  }

  type TVLStats {
    totalValueLocked: Decimal!
    activeVaultsCount: Int!
    formattedTvl: String!
    lastUpdatedAt: DateTime!
  }

  type Subscription {
    # Real-time subscriptions
    vaultUpdated(vaultAddress: String): Vault!
    beneficiaryUpdated(vaultAddress: String, beneficiaryAddress: String): Beneficiary!
    newClaim(userAddress: String): ClaimsHistory!
    withdrawalProcessed(vaultAddress: String, beneficiaryAddress: String): WithdrawableInfo!
    auditLogCreated: AuditLog!
    
    # TVL real-time updates
    tvlUpdated: TVLStats!
    
    # Admin subscriptions
    adminTransferUpdated(contractAddress: String): AdminTransfer!
  }
`;
