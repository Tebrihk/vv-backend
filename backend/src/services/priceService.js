const axios = require('axios');

class PriceService {
  constructor() {
    this.baseUrl = 'https://api.coingecko.com/api/v3';
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache
  }

  async getTokenPrice(tokenAddress, timestamp = null) {
    const cacheKey = `${tokenAddress}-${timestamp || 'latest'}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.price;
      }
    }

    try {
      let price;
      
      if (timestamp) {
        // Get historical price at specific timestamp
        const date = new Date(timestamp);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        price = await this.getHistoricalPrice(tokenAddress, dateStr);
      } else {
        // Get latest price
        price = await this.getLatestPrice(tokenAddress);
      }

      // Cache the result
      this.cache.set(cacheKey, {
        price,
        timestamp: Date.now()
      });

      return price;
    } catch (error) {
      console.error(`Error fetching price for token ${tokenAddress}:`, error.message);
      throw error;
    }
  }

  async getLatestPrice(tokenAddress) {
    // For ERC-20 tokens, we need to find the CoinGecko ID first
    const coinId = await this.getCoinGeckoId(tokenAddress);
    
    const response = await axios.get(`${this.baseUrl}/simple/price`, {
      params: {
        ids: coinId,
        vs_currencies: 'usd',
        precision: 18
      },
      timeout: 10000
    });

    if (!response.data[coinId] || !response.data[coinId].usd) {
      throw new Error(`No USD price found for token ${coinId}`);
    }

    return response.data[coinId].usd;
  }

  async getHistoricalPrice(tokenAddress, date) {
    // For ERC-20 tokens, we need to find the CoinGecko ID first
    const coinId = await this.getCoinGeckoId(tokenAddress);
    
    const response = await axios.get(`${this.baseUrl}/coins/${coinId}/history`, {
      params: {
        date,
        localization: false
      },
      timeout: 10000
    });

    if (!response.data.market_data || !response.data.market_data.current_price || !response.data.market_data.current_price.usd) {
      throw new Error(`No historical USD price found for token ${coinId} on ${date}`);
    }

    return response.data.market_data.current_price.usd;
  }

  async getCoinGeckoId(tokenAddress) {
    // Check cache first
    const cacheKey = `id-${tokenAddress}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout * 60) { // 1 hour cache for IDs
        return cached.coinId;
      }
    }

    try {
      // Search for the token by contract address
      const response = await axios.get(`${this.baseUrl}/coins/ethereum/contract/${tokenAddress.toLowerCase()}`, {
        timeout: 10000
      });

      const coinId = response.data.id;
      
      // Cache the result
      this.cache.set(cacheKey, {
        coinId,
        timestamp: Date.now()
      });

      return coinId;
    } catch (error) {
      // If direct contract lookup fails, try searching by address
      try {
        const searchResponse = await axios.get(`${this.baseUrl}/search`, {
          params: {
            query: tokenAddress
          },
          timeout: 10000
        });

        const result = searchResponse.data.coins.find(coin => 
          coin.platforms && coin.platforms.ethereum === tokenAddress.toLowerCase()
        );

        if (result) {
          // Cache the result
          this.cache.set(cacheKey, {
            coinId: result.id,
            timestamp: Date.now()
          });
          return result.id;
        }
      } catch (searchError) {
        console.error(`Search failed for token ${tokenAddress}:`, searchError.message);
      }

      throw new Error(`Could not find CoinGecko ID for token address ${tokenAddress}`);
    }
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = new PriceService();
