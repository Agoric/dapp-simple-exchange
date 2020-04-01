// Generic Agoric Dapp contract deployment script
// NOTE: YOUR CONTRACT-SPECIFIC INITIALIZATION is in install-contract.js
import fs from 'fs';

// This javascript source file uses the "tildot" syntax (foo~.bar()) for
// eventual sends.
// https://agoric.com/documentation/ertp/guide/other-concepts.html
//  Tildot is standards track with TC39, the JavaScript standards committee.
// https://github.com/tc39/proposal-wavy-dot

export default async function deployContract(homeP, { bundleSource, pathResolve }) {

  const [
    installBundle,
    contractBundle,
  ] = await Promise.all([
    bundleSource(pathResolve(`./install-contract.js`)),
    bundleSource(pathResolve(`./contract.js`)),
  ]);

  const wallet = homeP~.wallet;
  const zoe = homeP~.zoe;
  const registrar = homeP~.registrar;
  const timerService = homeP~.localTimerService;
  const uploads = homeP~.uploads;

  const installerInstall = homeP~.spawner~.install(
    installBundle.source,
    installBundle.moduleFormat,
  );
  const installer = installerInstall~.spawn({ wallet, zoe, uploads, registrar, timerService });

  const { CONTRACT_NAME, ADMIN_SEAT_UPLOAD, instanceId, initP, brandRegKeys = {} } =
    await installer~.initInstance(contractBundle, Date.now());

  console.log('- instance made', CONTRACT_NAME, '=>', instanceId);
  console.log('- admin seat upload ID', ADMIN_SEAT_UPLOAD);

  try {
    await initP;
  } catch (e) {
    console.error('cannot create initial offers', e);
  }

  // Save the instanceId somewhere where the UI can find it.
  const dappConstants = {
    BRIDGE_URL: 'agoric-lookup:https://local.agoric.com?append=/bridge',
    API_URL: '/',
    CONTRACT_ID: instanceId,
    ADMIN_SEAT_UPLOAD,
    brandRegKeys,
  };
  // FIXME: remove these flat entries.
  Object.entries(brandRegKeys).forEach(([keyword, brandRegKey]) => {
    dappConstants[`${keyword.toUpperCase()}_BRAND_REGKEY`] = brandRegKey;
  });
  const dc = 'dappConstants.js';
  console.log('writing', dc);
  await fs.promises.writeFile(dc, `globalThis.__DAPP_CONSTANTS__ = ${JSON.stringify(dappConstants, undefined, 2)}`);

  // Now add URLs so that development functions without internet access.
  dappConstants.BRIDGE_URL = "http://127.0.0.1:8000";
  dappConstants.API_URL = "http://127.0.0.1:8000";
  const defaultsFile = pathResolve(`../ui/src/utils/defaults.js`);
  console.log('writing', defaultsFile);
  const defaultsContents = `\
// GENERATED FROM contract/deploy.js
export default ${JSON.stringify(dappConstants, undefined, 2)};
`;
  await fs.promises.writeFile(defaultsFile, defaultsContents);
}
