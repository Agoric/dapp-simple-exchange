import harden from '@agoric/harden';
import makePromise from '@agoric/make-promise';

const CONTRACT_NAME = 'simple-exchange';

// This initInstance function is specific to the contract.
//
// Notably, it interacts with the contract to prepopulate some
// details.
export default harden(({ wallet, zoe, registrar, timerService }) => {
  return harden({
    async initInstance({ source, moduleFormat }, now = Date.now()) {
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

      const [brandRegKey0, brandRegKey1] = await Promise.all([
        wallet~.getIssuerNames(issuer0)~.brandRegKey,
        wallet~.getIssuerNames(issuer1)~.brandRegKey,
      ])
    
      // 2. Contract instance.
      const [
        invite,
        inviteIssuer,
      ] = await Promise.all([
        zoe~.makeInstance(installationHandle, {
          Asset: issuer0,
          Price: issuer1
        }, { timerService }),
        zoe~.getInviteIssuer(),
      ])
    
      // =====================
      // === AWAITING TURN ===
      // =====================
    
      // 3. Get the instanceHandle
    
      const {
        extent: [{ instanceHandle }],
      } = await inviteIssuer~.getAmountOf(invite);
      const instanceId = await registrar~.register(CONTRACT_NAME, instanceHandle);
    
      // Make simple-exchange initialisation here.
      const orders = [[true, 9, 5], [true, 3, 6], [false, 4, 7]];
      const allPerformed = orders.map(async ([buy, extent0, extent1], i) => {
        const kind0 = buy ? 'want' : 'give';
        const kind1 = buy ? 'give' : 'want';
    
        const publicID = `deploy-${now}-${i}`;
        const offer = {
          id: `${now}-${i}`,
          publicID,
      
          // Contract-specific metadata.
          instanceRegKey: instanceId,
      
          proposalTemplate: {
            [kind0]: {
              Asset: {
                pursePetname: pursePetname0,
                extent: extent0,
              },
            },

            [kind1]: {
              Price: {
                pursePetname: pursePetname1,
                extent: extent1,
              },
            },
            exit: { onDemand: null },
          },
        };
    
        const performed = makePromise();
        const hooks = harden({
          publicAPI: {
            getInvite(publicAPI) {
              return publicAPI~.makeInvite(publicID);
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
        const id = await wallet~.addOffer(offer, hooks, requestContext);
        wallet~.acceptOffer(id).catch(performed.rej);
        return performed.p;
      });

      const initP = Promise.all(allPerformed);
      return {
        CONTRACT_NAME,
        instanceId,
        initP,
        brandRegKeys: {
          Asset: brandRegKey0,
          Price: brandRegKey1,
        },
      };
    },
  });
});
