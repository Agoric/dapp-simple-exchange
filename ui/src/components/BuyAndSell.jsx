import React, { useCallback, useState, useEffect } from 'react';

import { makeStyles } from '@material-ui/core/styles';

import {
  Button,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  InputLabel,
} from '@material-ui/core';

import AssetInput from './AssetInput';

import { useApplicationContext } from '../contexts/Application';
import { createOffer } from '../store/actions';

const useStyles = makeStyles(theme => ({
  buy: {
    color: theme.palette.success.main,
  },
  sell: {
    color: theme.palette.warning.main,
  },
  message: {
    marginTop: theme.spacing(2),
    minHeight: theme.spacing(2),
  },
  button: {
    margin: theme.spacing(2),
  },
  btnBuy: {
    textTransform: 'none',
    fontSize: '1.5rem',
    color: '#FFFFFF',
    backgroundColor: theme.palette.success.main,
  },
  btnSell: {
    textTransform: 'none',
    fontSize: '1.5rem',
    color: '#FFFFFF',
    backgroundColor: theme.palette.warning.main,
  },
}));

/* eslint-disable complexity */

const getMatchingPurse = (purses, matchBrandRegKey, current) => {
  const matchingPurses = purses.filter(({brandRegKey}) =>
    brandRegKey === matchBrandRegKey);
  const already = current && matchingPurses.find(({pursePetname}) =>
    pursePetname === current.pursePetName);
  if (already) {
    return already;
  }
  if (matchingPurses.length > 0) {
    return matchingPurses[0];
  }
  return null;
};

export default function BuyAndSell() {
  const classes = useStyles();
  const { state, dispatch } = useApplicationContext();
  const {
    purses,
    assetBrandRegKey,
    priceBrandRegKey,
    connected,
  } = state;

  const [tab, setTab] = useState(0);
  const [assetAmount, setAssetAmount] = useState(0);
  const [priceAmount, setPriceAmount] = useState(0);
  const [assetPurse, setAssetPurse] = useState(null);
  const [pricePurse, setPricePurse] = useState(null);

  useEffect(() =>
    setAssetPurse(purse => getMatchingPurse(purses, assetBrandRegKey, purse)),
    [purses, assetBrandRegKey, setAssetPurse],
  );

  useEffect(() =>
    setPricePurse(purse => getMatchingPurse(purses, priceBrandRegKey, purse)),
    [purses, priceBrandRegKey, setPricePurse],
  );
  
  const buySell = tab === 0 ? 'buy' : 'sell';

  const assetAmountError =
    buySell === 'buy' ? assetAmount < 0 : (assetPurse && assetAmount > assetPurse.extent);
  const priceAmountError =
    buySell === 'sell' ? priceAmount < 0 : (pricePurse && priceAmount > pricePurse.extent);

  const pursesError =
    assetPurse &&
    pricePurse &&
    assetPurse.pursePetname === pricePurse.pursePetname;

  const hasError = pursesError || assetAmountError || priceAmountError;

  const isValid =
    !hasError &&
    assetPurse &&
    pricePurse &&
    assetAmount > 0 &&
    priceAmount > 0;

  function getButtonClass() {
    return buySell === 'buy' ? classes.btnBuy : classes.btnSell;
  }

  function getButtonLabel() {
    return buySell === 'buy' ? 'Buy' : 'Sell';
  }

  const onClick = useCallback(() =>
    dispatch(createOffer(tab === 0, assetAmount, assetPurse, priceAmount, pricePurse)),
    [dispatch, tab, assetAmount, assetPurse, priceAmount, pricePurse]);
  const onChangeTab = useCallback((event, newTab) => setTab(newTab), [setTab]);

  function getExchangeRate(decimal) {
    if (isValid) {
      const exchangeRate = (priceAmount / assetAmount).toFixed(decimal);
      return `Exchange rate: 1 ${assetPurse.issuerPetname} = ${exchangeRate} ${pricePurse.issuerPetname}`;
    }
    return '';
  }

  const assetInput = <Grid item key="asset"><AssetInput
    title={buySell === 'buy' ? 'Want' : 'Give'}
    purseLabel="Asset Purse"
    key="assetInput"
    targetBrandRegKey={assetBrandRegKey}
    purses={purses}
    onPurseChange={setAssetPurse}
    onAmountChange={setAssetAmount}
    purse={assetPurse}
    amount={assetAmount}
    disabled={!connected}
  /></Grid>;

  const priceInput = <Grid item key="price"><AssetInput
    title={buySell === 'buy' ? 'Give' : 'Want'}
    purseLabel="Price Purse"
    targetBrandRegKey={priceBrandRegKey}
    purses={purses}
    onPurseChange={setPricePurse}
    onAmountChange={setPriceAmount}
    purse={pricePurse}
    amount={priceAmount}
    disabled={!connected}
  /></Grid>;

  const inputsList = [assetInput];
  if (buySell === 'buy') {
    inputsList.push(priceInput);
  } else {
    inputsList.unshift(priceInput);
  }

  return (
    <Card>
      <Tabs
        variant="fullWidth"
        value={tab}
        onChange={onChangeTab}
      >
        <Tab label="Buy" className={buySell === 'buy' ? classes.buy : null} />
        <Tab label="Sell" className={buySell === 'sell' ? classes.sell : null} />
      </Tabs>

      <CardContent>
        <Grid container direction="column" spacing={3}>
          {inputsList}

          <Grid item>
            <InputLabel className={classes.message}>
              {getExchangeRate(4)}
            </InputLabel>
          </Grid>
          <Grid item>
            <Button variant="contained" onClick={onClick} fullWidth className={getButtonClass()} disabled={!isValid}>
              {getButtonLabel()}
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

/* eslint-enable complexity */
