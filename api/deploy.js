// Agoric Dapp api deployment script

export default async function deployApi(homeP, { bundleSource, pathResolve }) {
  let overrideInstanceId;
  const dc = `${process.cwd()}/dappConstants.js`;
  try {
    require(dc);
    overrideInstanceId = __DAPP_CONSTANTS__.CONTRACT_ID;
  } catch (e) {
    console.log(`Proceeeding with defaults; cannot load ${dc}:`, e.message);
  }

  const { source, moduleFormat } = await bundleSource(pathResolve('./handler.js'));
  const handlerInstall = homeP~.spawner~.install(source, moduleFormat);
  const [zoe, registrar, http] = await Promise.all(
    [homeP~.zoe, homeP~.registrar, homeP~.http]
  );
  const handler = handlerInstall~.spawn({zoe, registrar, http, overrideInstanceId});
  await homeP~.http~.registerAPIHandler(handler);
}
