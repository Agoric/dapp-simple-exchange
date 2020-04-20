// @ts-check
// Agoric Dapp api deployment script

import fs from 'fs';
import dappConstants from '../ui/src/utils/constants.js';
import { E } from '@agoric/eventual-send';
import harden from '@agoric/harden';
import { makeGetInstanceHandle } from '@agoric/zoe/src/clientSupport';
import makeAmountMath from '@agoric/ertp/src/amountMath';

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
export default async function deployApi(referencesPromise, { bundleSource, pathResolve }) {

  // Let's wait for the promise to resolve.
  const references = await referencesPromise;

  // Unpack the references.
  const { 

    // *** LOCAL REFERENCES ***

    // This wallet only exists on this machine, and only you have
    // access to it. The wallet stores purses and handles transactions.
    wallet, 

    // Scratch is a map only on this machine, and can be used for
    // communication in objects between processes/scripts on this
    // machine.
    uploads: scratch,  

    // The spawner persistently runs scripts within ag-solo, off-chain.
    spawner,

    // *** ON-CHAIN REFERENCES ***

    // Zoe lives on-chain and is shared by everyone who has access to
    // the chain. In this demo, that's just you, but on our testnet,
    // everyone has access to the same Zoe.
    zoe, 

    // The registry also lives on-chain, and is used to make private
    // objects public to everyone else on-chain. These objects get
    // assigned a unique string key. Given the key, other people can
    // access the object through the registry
    registry,

    // The http request handler.
    // TODO: add more explanation
    http,
  }  = references;


  // To get the backend of our dapp up and running, first we need to
  // grab the installationHandle that our contract deploy script put
  // in the public registry.
  const { 
    INSTALLATION_REG_KEY
  } = dappConstants;
  const simpleExchangeContractInstallationHandle = await E(registry).get(INSTALLATION_REG_KEY);
  
  // Second, we can use the installationHandle to create a new
  // instance of our contract code on Zoe. A contract instance is a running
  // program that can take offers through Zoe. Creating a contract
  // instance gives you an invite to the contract. In this case, it is
  // an invite to send an order to the exchange.

  // At the time that we make the contract instance, we need to tell
  // Zoe what kind of exchange is possible. In this instance, we will
  // only accept moola for simoleans and vice versa. (If we wanted to
  // accept other kinds, we could create other instances.) We need to
  // put this information in the form of a keyword (a string that the
  // contract determines, in this case, 'Asset' and 'Price') plus an
  // issuer for each: moolaIssuer for Asset and simoleanIssuer for Price.

  // In our example, moola and simoleans are widely used tokens.
  // Someone has already registered the moolaIssuer and simoleanIssuer
  // in the registry. We can also get them from our wallet.

  // getIssuers returns an array, because we currently cannot
  // serialize maps. We can immediately create a map using the array,
  // though. https://github.com/Agoric/agoric-sdk/issues/838
  const issuersArray = await E(wallet).getIssuers();
  const issuers = new Map(issuersArray);
  const moolaIssuer = issuers.get('moola');
  const simoleanIssuer = issuers.get('simolean');

  const getLocalAmountMath = issuer =>
    Promise.all([
      E(issuer).getBrand(),
      E(issuer).getMathHelpersName(),
    ]).then(([brand, mathHelpersName]) => makeAmountMath(brand, mathHelpersName));
    
  const moolaAmountMath = await getLocalAmountMath(moolaIssuer);
  const simoleanAmountMath = await getLocalAmountMath(simoleanIssuer);

  const issuerKeywordRecord = { Asset: moolaIssuer, Price: simoleanIssuer };
  const invite = await E(zoe).makeInstance(simpleExchangeContractInstallationHandle, issuerKeywordRecord);
  console.log('- SUCCESS! contract instance is running on Zoe');
  
  // Let's get the Zoe invite issuer to be able to inspect our invite further
  const inviteIssuer = await E(zoe).getInviteIssuer();

  // Use the helper function to get an instanceHandle from the invite.
  // An instanceHandle is like an installationHandle in that it is a
  // similar opaque identifier. In this case, though, it identifies a
  // running contract instance, not code. 
  const getInstanceHandle = makeGetInstanceHandle(inviteIssuer);
  const instanceHandle = await getInstanceHandle(invite);

  const { publicAPI } = await E(zoe).getInstanceRecord(instanceHandle);
  
  const pursesArray = await E(wallet).getPurses();
  const purses = new Map(pursesArray);

  const moolaPurse = purses.get('Fun budget');
  const simoleanPurse = purses.get('Nest egg');
  
  // Let's add some starting orders to the exchange.
  // TODO: deposit the resulting payouts back in our purse
  const orders = [[true, 9, 5], [true, 3, 6], [false, 4, 7]];

  const addOrder = async (isBuy, assetExtent, priceExtent) => {
    const invite = await E(publicAPI).makeInvite();
    const assetAmount = moolaAmountMath.make(assetExtent);
    const priceAmount = simoleanAmountMath.make(priceExtent);
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
      }
    };
    const proposal = isBuy ? buyProposal: sellProposal;
    const payments = {
      Asset: await E(moolaPurse).withdraw(assetAmount),
      Price: await E(simoleanPurse).withdraw(priceAmount),
    };

    const { payout, outcome, offerHandle } = await E(zoe).offer(invite, proposal, payments);
    return { payout, outcome, offerHandle };
  };

  const allPerformed = orders.map(([isBuy, assetExtent, priceExtent], i) =>
    addOrder(isBuy, assetExtent, priceExtent)
  );

  await Promise.all(allPerformed);

  // Now that we've done all the admin work, let's share this
  // instanceHandle by adding it to the registry. Any users of our
  // contract will use this instanceHandle to get invites to the
  // contract in order to make an offer.
  const INSTANCE_REG_KEY = await E(registry).register(`${dappConstants.CONTRACT_NAME}instance`, instanceHandle);

  console.log(`-- Contract Name: ${dappConstants.CONTRACT_NAME}`);
  console.log(`-- InstanceHandle Register Key: ${INSTANCE_REG_KEY}`);

  const { source, moduleFormat } = await bundleSource(pathResolve('./src/handler.js'));
  const handlerInstall = E(spawner).install(source, moduleFormat);

  const brandPs = [];
  const keywords = [];
  Object.entries(issuerKeywordRecord).map(async ([keyword, issuer]) => {
    keywords.push(keyword);
    brandPs.push(E(issuer).getBrand());
  });

  const handler = E(handlerInstall).spawn({ http, keywords, brandPs, publicAPI });

  await E(http).registerAPIHandler(handler);

  const { 
    brandRegKey: moolaBrandRegKey 
  } = await E(wallet).getIssuerNames(moolaIssuer);
  const { 
    brandRegKey: simoleanBrandRegKey
  } = await E(wallet).getIssuerNames(simoleanIssuer);

  // Re-save the constants somewhere where the UI and api can find it.
  const newDappConstants = {
    INSTANCE_REG_KEY,
    ASSET_BRAND_REG_KEY: moolaBrandRegKey,
    PRICE_BRAND_REG_KEY: simoleanBrandRegKey,
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
