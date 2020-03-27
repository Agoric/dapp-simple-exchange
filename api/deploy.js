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

  const { brandRegKeys, CONTRACT_ID, ADMIN_SEAT_UPLOAD } = dappConstants;

  const { source, moduleFormat } = await bundleSource(pathResolve('./handler.js'));
  const handlerInstall = homeP~.spawner~.install(source, moduleFormat);
  const [instance, zoe, registrar, http, adminSeat] = await Promise.all([
    homeP~.registrar~.get(CONTRACT_ID)
      .then(instanceHandle => homeP~.zoe~.getInstance(instanceHandle)),
    homeP~.zoe,
    homeP~.registrar,
    homeP~.http,
    homeP~.uploads~.get(ADMIN_SEAT_UPLOAD),
  ]);

  const { issuerKeywordRecord } = instance;
  const brands = {};
  await Promise.all(Object.entries(brandRegKeys).map(
    async ([keyword, brandRegKey]) => {
      brands[keyword] = await issuerKeywordRecord[keyword]~.getBrand();
    }));
  const adminSeats = {
    [overrideInstanceId]: adminSeat,
  };
  const handler = handlerInstall~.spawn({adminSeats, brands, brandRegKeys, zoe, registrar, http, overrideInstanceId});
  await homeP~.http~.registerAPIHandler(handler);
}
