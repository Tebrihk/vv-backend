# Verinode Vesting Vault System

A blockchain-based vesting vault system for managing token distributions and vesting schedules with cliff support for top-ups.

## API Documentation

The API is fully documented with Swagger UI. After starting the server, access the documentation at:

```
http://localhost:3000/api-docs
```

The documentation includes:
- Interactive API explorer for all endpoints
- Detailed parameter descriptions
- Example requests and responses
- Authentication information
- Model definitions

## Quick Start

Get the entire development environment running in minutes:

```bash
# Clone and start
git clone <repository-url>
cd Vesting-Vault
docker-compose up -d

# Verify it's working
curl http://localhost:3000/health
```

## Services

- **Backend API**: http://localhost:3000
- **PostgreSQL Database**: localhost:5432
- **Redis Cache**: localhost:6379

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed development setup and guidelines.

## Architecture

- **Backend**: Node.js with Express and Sequelize ORM
- **Database**: PostgreSQL for persistent storage
- **Cache**: Redis for session management and caching
- **Containerization**: Docker and Docker Compose for development environment

## Features

- **Vesting Schedules**: Flexible vesting with cliff periods and multiple top-ups
- **Admin Management**: Secure admin key management and audit logging
- **Price Tracking**: Historical price tracking for tax reporting
- **Delegate Claiming**: Allow beneficiaries to set delegates to claim on their behalf ([docs](./DELEGATE_CLAIMING.md))

## License

MIT
