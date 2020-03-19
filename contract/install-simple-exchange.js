import harden from '@agoric/harden';
import makePromise from '@agoric/make-promise';

// This initInstance function is specific to autoswap.
//
// Notably, it takes the first two purses of the wallet and
// uses them to add liquidity.
export default harden(({ wallet, zoe, registrar }) => {
  return harden({
    async initInstance(contractName, { source, moduleFormat }, now = Date.now()) {
      const installationHandle = await zoe~.install(source, moduleFormat);

      // =====================
      // === AWAITING TURN ===
      // =====================
    
      // 1. Issuers and purse petnames
      // Just take the first two purses.
      const [[pursePetname0], [pursePetname1]] = await wallet~.getPurses();

      // =====================
      // === AWAITING TURN ===
      // =====================
    
      const [issuer0, issuer1] = await Promise.all([
        wallet~.getPurseIssuer(pursePetname0),
        wallet~.getPurseIssuer(pursePetname1),
      ]);

      // =====================
      // === AWAITING TURN ===
      // =====================
    
      // 2. Contract instance.
      const [
        { invite },
        inviteIssuer,
      ] = await Promise.all([
        zoe~.makeInstance(installationHandle, { issuers: [issuer0, issuer1] }),
        zoe~.getInviteIssuer(),
      ])
    
      // =====================
      // === AWAITING TURN ===
      // =====================
    
      // 3. Get the instanceHandle
    
      const {
        extent: [{ instanceHandle }],
      } = await inviteIssuer~.getAmountOf(invite);
      const instanceId = await registrar~.register(contractName, instanceHandle);
    
      // Make simple-exchange initialisation here.
      const contractIssuerIndexToRole = ['TokenA', 'TokenB'];
      const orders = [[true, 9, 5], [true, 3, 6], [false, 4, 5]];

      const allPerformed = orders.map(async ([buy, extent0, extent1], i) => {
        const kind0 = buy ? 'want' : 'offer';
        const kind1 = buy ? 'offer' : 'want';
    
        const offerDesc = {
          id: `${now}-${i}`,
      
          // Contract-specific metadata.
          instanceRegKey: instanceId,
          contractIssuerIndexToRole,
      
          offerRulesTemplate: {
            [kind0]: {
              'Token*': {
                pursePetname: pursePetname0,
                extent: extent0,
              },
            },

            [kind1]: {
              'Token*': {
                pursePetname: pursePetname1,
                extent: extent1,
              },
            },
            exit: { onDemand: {} },
          },
        };
    
        const performed = makePromise();
        const hooks = harden({
          publicAPI: {
            getInvite(publicAPI) {
              return publicAPI~.makeInvite(`deploy-${now}-${i}`)~.invite;
            },
          },
          seat: {
            async performOffer(seat) {
              const p = seat~.addOrder();
              p.then(performed.res, performed.rej);
              return p;
            },
          },
        });

        // Use the wallet's offer system to finish the deployment.
        const requestContext = { origin: 'simple-exchange deploy', date: now };
        const id = await wallet~.addOffer(offerDesc, hooks, requestContext);
        wallet~.acceptOffer(id).catch(performed.rej);
        return performed.p;
      });

      const initP = Promise.all(allPerformed);
      return { instanceId, initP };
    },
  });
});
