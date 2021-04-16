// @ts-check
import fs from 'fs';
import { E } from '@agoric/eventual-send';
import '@agoric/zoe/exported';

// This script takes our contract code, installs it on Zoe, and makes
// the installation publicly available. Our backend API script will
// use this installation in a later step.

/**
 * @typedef {Object} DeployPowers The special powers that agoric deploy gives us
 * @property {(path: string) => { moduleFormat: string, source: string }} bundleSource
 * @property {(path: string) => string} pathResolve
 */

export default async function deployContract(
  referencesPromise,
  { bundleSource, pathResolve },
) {
  // Your off-chain machine (what we call an ag-solo) starts off with
  // a number of references, some of which are shared objects on chain, and
  // some of which are objects that only exist on your machine.

  // Let's wait for the promise to resolve.
  const references = await referencesPromise;

  // Unpack the references.
  const {
    // *** ON-CHAIN REFERENCES ***

    // Zoe lives on-chain and is shared by everyone who has access to
    // the chain. In this demo, that's just you, but on our testnet,
    // everyone has access to the same Zoe.
    /** @typedef {Zoe} */
    zoe,

    // The board is an on-chain object that is used to make private
    // on-chain objects public to everyone else on-chain. These
    // objects get assigned a unique string id. Given the id, other
    // people can access the object through the board. Ids and values
    // have a one-to-one bidirectional mapping. If a value is added a
    // second time, the original id is just returned.
    /** @typedef {Board} */
    board,
  } = references;

  // First, we must bundle up our contract code (./src/contract.js)
  // and install it on Zoe. This returns an installationHandle, an
  // opaque, unforgeable identifier for our contract code that we can
  // reuse again and again to create new, live contract instances.
  const bundle = await bundleSource(pathResolve(`./src/contract.js`));
  const installation = await E(zoe).install(bundle);

  // Let's share this installation with other people, so that
  // they can run our simpleExchange contract code by making a contract
  // instance (see the api deploy script in this repo to see an
  // example of how to use the installation to make a new contract
  // instance.)

  // To share the installation, we're going to put it in the
  // board. The board is a shared, on-chain object that has a
  // one-to-one mapping between strings and objects.
  const CONTRACT_NAME = 'simple-exchange';
  const INSTALLATION_BOARD_ID = await E(board).getId(installation);
  console.log('- SUCCESS! contract code installed on Zoe');
  console.log(`-- Contract Name: ${CONTRACT_NAME}`);
  console.log(`-- Installation Board Id: ${INSTALLATION_BOARD_ID}`);

  // Save the installation Board Id somewhere where the UI can find it.
  const dappConstants = {
    BRIDGE_URL: 'agoric-lookup:https://local.agoric.com?append=/bridge',
    API_URL: '/',
    CONTRACT_NAME,
    INSTALLATION_BOARD_ID,
  };
  const dc = 'dappConstants.js';
  console.log('writing', dc);
  await fs.promises.writeFile(
    dc,
    `globalThis.__DAPP_CONSTANTS__ = ${JSON.stringify(
      dappConstants,
      undefined,
      2,
    )}`,
  );

  // Now add URLs so that development functions without internet access.
  dappConstants.BRIDGE_URL = 'http://127.0.0.1:8000';
  dappConstants.API_URL = 'http://127.0.0.1:8000';
  const defaultsFile = pathResolve(`../ui/src/utils/defaults.js`);
  console.log('writing', defaultsFile);
  const defaultsContents = `\
// GENERATED FROM contract/deploy.js
export default ${JSON.stringify(dappConstants, undefined, 2)};
`;
  await fs.promises.writeFile(defaultsFile, defaultsContents);
}
