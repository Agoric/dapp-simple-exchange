// Agoric Dapp api deployment script

export default async function deployApi(homeP, { bundleSource, pathResolve }) {
  let overrideInstanceId;
  const dc = `${process.cwd()}/dappConstants.js`;
  let dappConstants;
  try {
    require(dc);
    dappConstants = __DAPP_CONSTANTS__;
    overrideInstanceId = __DAPP_CONSTANTS__.CONTRACT_ID;
  } catch (e) {
    console.log(`Proceeeding with defaults; cannot load ${dc}:`, e.message);
  }

  const { source, moduleFormat } = await bundleSource(pathResolve('./handler.js'));
  const handlerInstall = homeP~.spawner~.install(source, moduleFormat);
  const [instance, zoe, registrar, http] = await Promise.all([
    homeP~.registrar~.get(dappConstants.CONTRACT_ID)
      .then(instanceHandle => homeP~.zoe~.getInstance(instanceHandle)),
    homeP~.zoe,
    homeP~.registrar,
    homeP~.http,
  ]);

  const { issuerKeywordRecord } = instance;
  const issuers = [issuerKeywordRecord.Asset, issuerKeywordRecord.Price];
  const brands = {};
  await Promise.all([dappConstants.ASSET_BRAND_REGKEY, dappConstants.PRICE_BRAND_REGKEY].map(
    async (brandRegKey, index) => {
      brands[brandRegKey] = await issuers[index]~.getBrand();
    }));
  const handler = handlerInstall~.spawn({brands, zoe, registrar, http, overrideInstanceId});
  await homeP~.http~.registerAPIHandler(handler);
}
