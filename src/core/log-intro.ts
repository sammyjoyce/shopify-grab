import { LOGO_SVG } from "../constants.js";

export const logIntro = () => {
  try {
    const version = process.env.VERSION;
    const logoDataUri = `data:image/svg+xml;base64,${btoa(LOGO_SVG)}`;
    console.log(
      `%cShopify Grab${version ? ` v${version}` : ""}%c\nHover + Cmd/Ctrl+C to grab Shopify theme context`,
      `background: #1a3d0a; color: #ffffff; border: 1px solid #5AB33F; padding: 4px 4px 4px 24px; border-radius: 4px; background-image: url("${logoDataUri}"); background-size: 16px 16px; background-repeat: no-repeat; background-position: 4px center; display: inline-block; margin-bottom: 4px;`,
      "",
    );
  } catch {}
};
