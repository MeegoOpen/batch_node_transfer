import React, { Suspense, lazy } from "react";
import { initShared } from "../../infra/initShared";
import initRoot from "../../infra/initRoot";
import sdk from "../../utils/sdk";
import { getProjectKey } from "../../utils";

const ButtonsCom = lazy(() => import("../../page/Buttons"));

export default async function main() {
  const root = await initRoot();
  await initShared();
  const customCtx: any = await sdk.button.getContext();
  root.render(
    <Suspense fallback={null}>
      <ButtonsCom {...customCtx} />
    </Suspense>
  );
}

const LogsModal = lazy(() => import("../../page/Buttons/Error"));
export const LogErrorModal = async () => {
  const root = await initRoot();
  const ctx = await sdk.Context.load();
  const modelCtx: any = await ctx.getCustomContext();
  const projectKey = await getProjectKey();
  const { logs } = modelCtx;
  root.render(
    <Suspense fallback={<></>}>
      <LogsModal logs={logs} spaceId={projectKey} />
    </Suspense>
  );
};
