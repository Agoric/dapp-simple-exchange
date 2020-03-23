import React from 'react';

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
import { updatePurse, updateAmount } from '../store/actions';

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

export default function BuyAndSell() {
  const classes = useStyles();
  const { state, dispatch } = useApplicationContext();
  const {
    purses,
    assetIssuer,
    priceIssuer,
    assetPurse,
    pricePurse,
    assetAmount,
    priceAmount,
    connected,
  } = state;

  const [tab, setTab] = React.useState(0);

  const assetAmountError =
    assetAmount < 0 || (assetPurse && assetAmount > assetPurse.extent);
  const priceAmountError = priceAmount < 0;

  const pursesError =
    assetPurse &&
    pricePurse &&
    assetPurse.allegedName === pricePurse.allegedName;

  const hasError = pursesError || assetAmountError || priceAmountError;

  const isValid =
    !hasError &&
    assetPurse &&
    pricePurse &&
    assetAmount > 0 &&
    priceAmount > 0;

  const handleChangeTab = (event, newTab) => {
    setTab(newTab);
  };

  function getButtonClass() {
    return tab === 0 ? classes.btnBuy : classes.btnSell;
  }

  function getButtonLabel() {
    return tab === 0 ? 'Buy' : 'Sell';
  }

  function onAssetPurseChange(ev, purse) {
    return dispatch(updatePurse(purse.props.value, true));
  }

  function onPricePurseChange(ev, purse) {
    return dispatch(updatePurse(purse.props.value, false));
  }

  function onAssetAmountChange(ev) {
    return dispatch(updateAmount(ev.target.value, true));
  }

  function onPriceAmountChange(ev) {
    return dispatch(updateAmount(ev.target.value, false));
  }

  function getExchangeRate(decimal) {
    if (isValid) {
      const exchangeRate = (priceAmount / assetAmount).toFixed(decimal);
      return `Exchange rate: 1 ${assetPurse.assayId} = ${exchangeRate} ${pricePurse.assayId}`;
    }
    return '';
  }

  const assetInput = <AssetInput
    title={tab === 0 ? 'Want' : 'Give'}
    purseLabel="Asset Purse"
    targetIssuer={assetIssuer}
    purses={purses}
    onPurseChange={onAssetPurseChange}
    onAmountChange={onAssetAmountChange}
    purse={assetPurse}
    amount={assetAmount}
    disabled={!connected}
  />;

  const priceInput = <AssetInput
    title={tab === 0 ? 'Give' : 'Want'}
    purseLabel="Price Purse"
    targetIssuer={priceIssuer}
    purses={purses}
    onPurseChange={onPricePurseChange}
    onAmountChange={onPriceAmountChange}
    purse={pricePurse}
    amount={priceAmount}
    disabled={!connected}
  />;

  return (
    <Card>
      <Tabs
        variant="fullWidth"
        value={tab}
        onChange={handleChangeTab}
      >
        <Tab label="Buy" className={tab === 0 ? classes.buy : null} />
        <Tab label="Sell" className={tab === 1 ? classes.sell : null} />
      </Tabs>

      <CardContent>
        <Grid container direction="column" spacing={3}>
          <Grid item>
            {tab === 0 ? priceInput : assetInput}
          </Grid>

          <Grid item>
            {tab === 0 ? assetInput : priceInput}
          </Grid>

          <Grid item>
            <InputLabel className={classes.message}>
              {connected && isValid && getExchangeRate(4)}
            </InputLabel>
          </Grid>
          <Grid item>
            <Button variant="contained" fullWidth className={getButtonClass()}>
              {getButtonLabel()}
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

/* eslint-enable complexity */
