const { ClaimsHistory } = require('../models');
const priceService = require('./priceService');

class IndexingService {
  async processClaim(claimData) {
    try {
      const {
        user_address,
        token_address,
        amount_claimed,
        claim_timestamp,
        transaction_hash,
        block_number
      } = claimData;

      // Fetch the token price at the time of claim
      const price_at_claim_usd = await priceService.getTokenPrice(
        token_address,
        claim_timestamp
      );

      // Create the claim record with price data
      const claim = await ClaimsHistory.create({
        user_address,
        token_address,
        amount_claimed,
        claim_timestamp,
        transaction_hash,
        block_number,
        price_at_claim_usd
      });

      console.log(`Processed claim ${transaction_hash} with price $${price_at_claim_usd}`);
      return claim;
    } catch (error) {
      console.error('Error processing claim:', error);
      throw error;
    }
  }

  async processBatchClaims(claimsData) {
    const results = [];
    const errors = [];

    for (const claimData of claimsData) {
      try {
        const result = await this.processClaim(claimData);
        results.push(result);
      } catch (error) {
        errors.push({
          transaction_hash: claimData.transaction_hash,
          error: error.message
        });
      }
    }

    return {
      processed: results.length,
      errors: errors.length,
      results,
      errors
    };
  }

  async backfillMissingPrices() {
    try {
      // Find all claims without price data
      const claimsWithoutPrice = await ClaimsHistory.findAll({
        where: {
          price_at_claim_usd: null
        },
        order: [['claim_timestamp', 'ASC']],
        limit: 100 // Process in batches to avoid rate limits
      });

      console.log(`Found ${claimsWithoutPrice.length} claims without price data`);

      for (const claim of claimsWithoutPrice) {
        try {
          const price = await priceService.getTokenPrice(
            claim.token_address,
            claim.claim_timestamp
          );

          await claim.update({ price_at_claim_usd: price });
          console.log(`Backfilled price for claim ${claim.transaction_hash}: $${price}`);
        } catch (error) {
          console.error(`Failed to backfill price for claim ${claim.transaction_hash}:`, error.message);
        }
      }

      return claimsWithoutPrice.length;
    } catch (error) {
      console.error('Error in backfillMissingPrices:', error);
      throw error;
    }
  }

  async getRealizedGains(userAddress, startDate = null, endDate = null) {
    try {
      const whereClause = {
        user_address: userAddress,
        price_at_claim_usd: {
          [require('sequelize').Op.ne]: null
        }
      };

      if (startDate) {
        whereClause.claim_timestamp = {
          [require('sequelize').Op.gte]: startDate
        };
      }

      if (endDate) {
        whereClause.claim_timestamp = {
          ...whereClause.claim_timestamp,
          [require('sequelize').Op.lte]: endDate
        };
      }

      const claims = await ClaimsHistory.findAll({
        where: whereClause,
        order: [['claim_timestamp', 'ASC']]
      });

      let totalRealizedGains = 0;

      for (const claim of claims) {
        const realizedGain = parseFloat(claim.amount_claimed) * parseFloat(claim.price_at_claim_usd);
        totalRealizedGains += realizedGain;
      }

      return {
        user_address: userAddress,
        total_realized_gains_usd: totalRealizedGains,
        claims_processed: claims.length,
        period: {
          start_date: startDate,
          end_date: endDate
        }
      };
    } catch (error) {
      console.error('Error calculating realized gains:', error);
      throw error;
    }
  }
}

module.exports = new IndexingService();
