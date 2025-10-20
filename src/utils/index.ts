import { snakeCase } from "lodash";
import sdk from "./sdk";

export const handleErrorMsg = (e: any, minVersion?: string) => {
  let msg = "";
  if (e.name === "NotSupportedError") {
    msg = minVersion
      ? `当前客户端暂不支持，\n请升级飞书客户端到${minVersion}及以上版本`
      : "当前客户端暂不支持，\n请升级飞书客户端到最新版本";
  } else {
    msg = "内部错误:" + (e.message || e.originMessage);
  }
  // document.body.appendChild(document.createTextNode(msg));
};

export const getLang = async () => {
  const { language } =
    (await sdk.Context.load().catch((e) => handleErrorMsg(e))) || {};
  return language || "zh_CN";
};

export const getStorage = (key: string) =>
  sdk.storage
    .getItem(key)
    .then((res) => res ?? null)
    .catch((e) => handleErrorMsg(e));

export const setStorage = (key: string, value?: string) => {
  sdk.storage.setItem(key, value).catch((e) => handleErrorMsg(e));
};

export const removeStorage = (key: string) =>
  sdk.storage.removeItem(key).catch((e) => handleErrorMsg(e));

export const getProjectKey = async () => {
  const [controlCtx, buttonCtx, configCtx, pageCtx, tabCtx, viewCtx] =
    await Promise.all([
      sdk.control.getContext().catch((e) => handleErrorMsg(e, '7.25.0')),
      sdk.button.getContext().catch((e) => handleErrorMsg(e, '7.25.0')),
      sdk.configuration.getContext().catch((e) => handleErrorMsg(e, '7.25.0')),
      sdk.page.getContext().catch((e) => handleErrorMsg(e, '7.25.0')),
      sdk.tab.getContext().catch((e) => handleErrorMsg(e, '7.25.0')),
      sdk.view.getContext().catch((e) => handleErrorMsg(e, '7.25.0')),
    ]);

  return (
    configCtx?.spaceId ||
    controlCtx?.spaceId ||
    buttonCtx?.spaceId ||
    pageCtx?.spaceId ||
    tabCtx?.spaceId ||
    viewCtx?.spaceId ||
    ''
  );
};
