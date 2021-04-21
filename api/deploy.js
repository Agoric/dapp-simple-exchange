// @ts-check
// Agoric Dapp api deployment script

import fs from 'fs';
import { E } from '@agoric/eventual-send';
import { amountMath } from '@agoric/ertp';
import dappConstants from '../ui/src/utils/constants.js';

// deploy.js runs in an ephemeral Node.js outside of swingset. The
// spawner runs within ag-solo, so is persistent.  Once the deploy.js
// script ends, connections to any of its objects are severed.

/**
 * @typedef {Object} DeployPowers The special powers that `agoric deploy` gives us
 * @property {(path: string) => { moduleFormat: string, source: string }} bundleSource
 * @property {(path: string) => string} pathResolve
 */

/**
 * @param {any} referencesPromise A promise for the references
 * available from REPL home
 * @param {DeployPowers} powers
 */
export default async function deployApi(
  referencesPromise,
  { bundleSource, pathResolve },
) {
  // Let's wait for the promise to resolve.
  const references = await referencesPromise;

  // Unpack the references.
  const {
    // *** LOCAL REFERENCES ***

    // This wallet only exists on this machine, and only you have
    // access to it. The wallet stores purses and handles transactions.
    wallet,

    // The spawner persistently runs scripts within ag-solo, off-chain.
    spawner,

    // *** ON-CHAIN REFERENCES ***

    // Zoe lives on-chain and is shared by everyone who has access to
    // the chain. In this demo, that's just you, but on our testnet,
    // everyone has access to the same Zoe.
    zoe,

    // The http request handler.
    // TODO: add more explanation
    http,

    // The board is an on-chain object that is used to make private
    // on-chain objects public to everyone else on-chain. These
    // objects get assigned a unique string id. Given the id, other
    // people can access the object through the board. Ids and values
    // have a one-to-one bidirectional mapping. If a value is added a
    // second time, the original id is just returned.
    board,
  } = references;

  // To get the backend of our dapp up and running, first we need to
  // grab the installation that our contract deploy script put
  // in the public board.
  const { INSTALLATION_BOARD_ID } = dappConstants;
  const simpleExchangeContractInstallation = await E(board).getValue(
    INSTALLATION_BOARD_ID,
  );

  // Second, we can use the installation to create a new
  // instance of our contract code on Zoe. A contract instance is a running
  // program that can take offers through Zoe. Creating a contract
  // instance gives you an invitation to the contract. In this case, it is
  // an invitation to send an order to the exchange.

  // At the time that we make the contract instance, we need to tell
  // Zoe what kind of exchange is possible. In this instance, we will
  // only accept moola for simoleans and vice versa. (If we wanted to
  // accept other kinds, we could create other instances.) We need to
  // put this information in the form of a keyword (a string that the
  // contract determines, in this case, 'Asset' and 'Price') plus an
  // issuer for each: moolaIssuer for Asset and simoleanIssuer for Price.

  // In our example, moola and simoleans are widely used tokens.

  // getIssuers returns an array, because we currently cannot
  // serialize maps. We can immediately create a map using the array,
  // though. https://github.com/Agoric/agoric-sdk/issues/838
  const issuersArray = await E(wallet).getIssuers();
  const issuers = new Map(issuersArray);
  const moolaIssuer = issuers.get('moola');
  const simoleanIssuer = issuers.get('simolean');

  const moolaBrand = await E(moolaIssuer).getBrand();
  const simoleanBrand = await E(simoleanIssuer).getBrand();

  const issuerKeywordRecord = { Asset: moolaIssuer, Price: simoleanIssuer };
  /** @typedef {StartInstanceResult} */
  const { publicFacet, instance } = await E(zoe).startInstance(
    simpleExchangeContractInstallation,
    issuerKeywordRecord,
  );
  console.log('- SUCCESS! contract instance is running on Zoe');

  const pursesArray = await E(wallet).getPurses();
  const purses = new Map(pursesArray);

  const moolaPurse = purses.get('Fun budget');
  const simoleanPurse = purses.get('Nest egg');

  // Let's add some starting orders to the exchange.
  // TODO: deposit the resulting payouts back in our purse
  const orders = [
    [true, 9n, 5n],
    [true, 3n, 6n],
    [false, 4n, 7n],
  ];

  const addOrder = async (isBuy, assetValue, priceValue) => {
    const invitation = await E(publicFacet).makeInvitation();
    const assetAmount = amountMath.make(moolaBrand, assetValue);
    const priceAmount = amountMath.make(simoleanBrand, priceValue);
    const buyProposal = {
      want: {
        Asset: assetAmount,
      },
      give: {
        Price: priceAmount,
      },
    };
    const sellProposal = {
      want: {
        Price: priceAmount,
      },
      give: {
        Asset: assetAmount,
      },
    };
    const proposal = isBuy ? buyProposal : sellProposal;
    const payments = {
      Asset: await E(moolaPurse).withdraw(assetAmount),
      Price: await E(simoleanPurse).withdraw(priceAmount),
    };

    const seat = await E(zoe).offer(invitation, proposal, payments);
    return seat;
  };

  const allPerformed = orders.map(([isBuy, assetValue, priceValue]) =>
    addOrder(isBuy, assetValue, priceValue),
  );

  await Promise.all(allPerformed);

  // Now that we've done all the admin work, let's share this
  // instance by adding it to the board. Any users of our
  // contract will use this instance to get invitations to the
  // contract in order to make an offer.
  const INSTANCE_BOARD_ID = await E(board).getId(instance);

  console.log(`-- Contract Name: ${dappConstants.CONTRACT_NAME}`);
  console.log(`-- Instance Board Id: ${INSTANCE_BOARD_ID}`);

  const bundle = await bundleSource(pathResolve('./src/handler.js'));
  const handlerInstall = E(spawner).install(bundle);

  const brandPs = [];
  const keywords = [];
  Object.entries(issuerKeywordRecord).map(async ([keyword, issuer]) => {
    keywords.push(keyword);
    brandPs.push(E(issuer).getBrand());
  });

  const invitationIssuer = await E(zoe).getInvitationIssuer();
  const invitationBrand = await E(invitationIssuer).getBrand();
  const INVITATION_BRAND_BOARD_ID = await E(board).getId(invitationBrand);

  const handler = E(handlerInstall).spawn({
    http,
    keywords,
    brandPs,
    publicFacet,
    board,
    invitationIssuer,
  });

  await E(http).registerAPIHandler(handler);

  const moolaBrandBoardId = await E(board).getId(moolaBrand);
  const simoleanBrandBoardId = await E(board).getId(simoleanBrand);

  // Re-save the constants somewhere where the UI and api can find it.
  const newDappConstants = {
    INSTANCE_BOARD_ID,
    INVITATION_BRAND_BOARD_ID,
    ASSET_BRAND_BOARD_ID: moolaBrandBoardId,
    PRICE_BRAND_BOARD_ID: simoleanBrandBoardId,
    ...dappConstants,
  };
  const defaultsFile = pathResolve(`../ui/src/utils/defaults.js`);
  console.log('writing', defaultsFile);
  const defaultsContents = `\
  // GENERATED FROM ${pathResolve('./deploy.js')}
  export default ${JSON.stringify(newDappConstants, undefined, 2)};
  `;
  await fs.promises.writeFile(defaultsFile, defaultsContents);
}
