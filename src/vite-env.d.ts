/// <reference types="vite/client" />

declare module '*?script&loader' {
  const fileName: string;
  export default fileName;
}
