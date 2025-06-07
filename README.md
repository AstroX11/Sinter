# `Quantava`

## About

Quantava is an open-source ORM built on top of [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), providing a precise and efficient abstraction layer for SQLite databases. It eliminates the complexities of raw SQL queries while ensuring high performance.

## Get Started

### Prerequisites for Windows

To install `better-sqlite3` on Windows, ensure you have the following installed:

- **Microsoft Visual Studio** (with the "Desktop development with C++" workload)
- **Microsoft C++ Build Tools**
- **Windows 11 SDK**
- **Latest MSVC compiler**

Download and install these components via the [Microsoft Visual Studio Installer](https://visualstudio.microsoft.com/visual-cpp-build-tools/).

Alternatively, install the **Build Tools for Visual Studio** directly:

👉 [Download Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### Prerequisites for Linux/macOS

On Linux and macOS, installation of `better-sqlite3` is generally simpler but may require:

- **Build essentials:**

  - Linux: `build-essential` package or equivalent (e.g., `gcc`, `make`, `g++`)
  - macOS: Xcode Command Line Tools (`xcode-select --install`)

- **SQLite development libraries:**

  - Linux: `libsqlite3-dev` or equivalent
  - macOS: Usually bundled, but if issues arise, install via Homebrew:

    ```bash
    brew install sqlite3
    ```

If these tools or libraries are missing, `better-sqlite3` installation may fail.

### Install `better-sqlite3`

Quantava does **not** include `better-sqlite3` out of the box to maintain its lightweight nature. Before using Quantava, install `better-sqlite3` in your project:

```bash
npm i better-sqlite3
```

### Install Quantava

```bash
npm i quantava
```

```bash
yarn add quantava
```

```bash
pnpm install quantava
```

## Contributing

Your contributions drive this project forward, from bug fixes and feature enhancements to thoughtful suggestions. All forms of contribution are welcomed and valued.
