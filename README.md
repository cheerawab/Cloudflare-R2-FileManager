# Cloudflare R2 Visual Editor

A modern, desktop-based file manager for [Cloudflare R2 Storage](https://www.cloudflare.com/developer-platform/r2/), built with Electron and React.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![Electron](https://img.shields.io/badge/electron-28.2.0-blueviolet.svg)
![React](https://img.shields.io/badge/react-18.2.0-61dafb.svg)

## 🌟 Features

-   **⚡ High Performance**: Built with Vite and Electron for a snappy experience.
-   **🎨 Modern UI**: Beautiful glassmorphism design with Light/Dark mode support.
-   **📂 File Management**:
    -   Upload, Download, and Delete files.
    -   Virtual Folder support (navigate logical paths like `assets/images/`).
    -   Sortable file lists (Name, Size, Last Modified).
    -   Search functionality.
-   **🌍 Localization**: Full support for **English** and **Traditional Chinese (繁體中文)**.
-   **🔐 Security**:
    -   Secure credential management (Access Key ID / Secret Key).
    -   Automatic validation to prevent using API Tokens incorrectly.
-   **🚀 Cloudflare Integration**: Direct connection to R2 buckets without needing public access enabled.

## 🛠️ Technology Stack

-   **Framework**: [Electron](https://www.electronjs.org/)
-   **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
-   **Styling**: [TailwindCSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
-   **Icons**: [Lucide React](https://lucide.dev/)
-   **Storage**: [AWS SDK for JavaScript v3](https://aws.amazon.com/sdk-for-javascript/) (S3 Client)

## 📦 Installation & Build

### Prerequisites

-   Node.js (v16 or higher)
-   npm or yarn

### Development

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/Cloudflare-R2-FileManager.git
    cd Cloudflare-R2-FileManager
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Run in development mode:
    ```bash
    npm run dev
    ```

### Build for Production

To create a distributable installer (dmg, exe, AppImage):

```bash
# Build for all platforms
npm run build

# Build for specific platform
npm run build:win   # Windows
npm run build:mac   # macOS
npm run build:linux # Linux
```

## 📝 Usage

1.  **Login**: Enter your Cloudflare R2 credentials.
    -   **Endpoint**: Your R2 S3 API Endpoint (e.g., `https://<account_id>.r2.cloudflarestorage.com`)
    -   **Access Key ID**: Generated from Cloudflare Dashboard (R2 > Manage API Tokens).
    -   **Secret Access Key**: Your secret key.
2.  **Browse**: Select a bucket to explore.
3.  **Manage**: Drag & drop to upload, or use the interface to manage files.
4.  **Customize**: Go to Settings to toggle Dark Mode or switch between English/Traditional Chinese.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Credits

-   **Author**: Cheerawab
-   **Icon Design**: Gemini Nano Banana Pro
