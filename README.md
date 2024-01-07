# Solidity Boilerplate

A simple, yet effective starting point for your Solidity projects.

Features
- Clear and concise project structure
- TypeScript integration for enhanced developer experience
- Hardhat configuration for compilation, testing, deployment, and more
- Solhint integration for linting and code quality checks
- Basic testing setup using Mocha and Chai

## TOC

- [Solidity Boilerplate](#solidity-boilerplate)
  * [TOC](#toc)
  * [Getting Started](#getting-started)
  * [Project Structure](#project-structure)
  * [Contribute](#contribute)
  * [License](#license)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/jhelison/solidity-boilerplate.git
```

2. Install dependencies:

```bash
cd solidity-boilerplate
yarn install
```

3. Compile contracts:

```bash
yarn compile
```

4. Run tests:

```bash
yarn test
```

5. Deploy contracts (optional):

- Configure your desired network in `hardhat.config.ts`.
- Use Hardhat tasks for deployment.

## Project Structure

```
solidity-boilerplate/
├── contracts/              # Solidity contracts
├── scripts/                # Hardhat scripts
├── test/                   # Tests
├── package.json            # Project dependencies
├── hardhat.config.ts       # Hardhat configuration
├── solhint.json            # Solhint configuration
└── README.md               # This file
```

## Contribute

Contributions are welcome. Please open an issue or submit a pull request with your proposed changes.

## License

This project is open-sourced software licensed under the MIT License.
