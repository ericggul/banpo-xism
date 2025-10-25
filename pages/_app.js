import { createGlobalStyle, ThemeProvider } from "styled-components";
import useResize from "@/utils/hooks/useResize";
import "@/styles/globals.css";

import Head from "next/head";

const GlobalStyle = createGlobalStyle`
  html {
    overscroll-behavior: none;
    overflow: hidden;
  }

  body {
    margin: 0;
    padding: 0;
    box-sizing: border-box;

    -webkit-touch-callout: none; /* iOS Safari */
    -webkit-user-select: none; /* Safari */
    -khtml-user-select: none; /* Konqueror HTML */
    -moz-user-select: none; /* Old versions of Firefox */
    -ms-user-select: none; /* Internet Explorer/Edge */
    user-select: none;
    font-family: Helvetica;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  h1, h2, h3, h4, h5, h6, p{
    margin: 0;
    padding: 0;
  }


  input {
    border-radius: 0;
    -webkit-appearance: none;
  }

  /* Chrome, Safari, Edge, Opera */
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  /* Firefox */
  input[type=number] {
    -moz-appearance: textfield;
  }
`;

function MyApp({ Component, pageProps }) {
  const [windowWidth, windowHeight, fixedHeight] = useResize();

  return (
    <>
      <Head>
        <title>Banpo Xism</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <base target="_blank" />
      </Head>
      <GlobalStyle />
      <ThemeProvider theme={{ windowWidth, windowHeight, fixedHeight }}>
        <Component {...pageProps} />
      </ThemeProvider>
    </>
  );
}

export default MyApp;
