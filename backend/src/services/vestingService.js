class VestingService {

  async exampleFunction() {
    try {
      return {
        success: true,
        message: "Vesting service is working"
      };
    } catch (error) {
      throw error;
    }
  }

}

module.exports = new VestingService();
