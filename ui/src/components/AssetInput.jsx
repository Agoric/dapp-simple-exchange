import React, { useCallback, useMemo } from 'react';
import clsx from 'clsx';

import { makeStyles } from '@material-ui/core/styles';
import {
  Grid,
  TextField,
  MenuItem,
  ListItemText,
} from '@material-ui/core';

const useStyles = makeStyles(theme => ({
  select: {
    display: 'flex',
    alignItems: 'center',
  },
  noPadding: {
    paddingTop: 0,
    paddingBottom: 0,
  },
}));

/* eslint-disable react/prop-types */
export default function AssetInput({
  title,
  purses,
  purseLabel,
  onPurseChange,
  onAmountChange,
  purse,
  targetBrandRegKey,
  amount,
  disabled,
  purseError,
  amountError,
}) {
  const classes = useStyles();
  const purseClass = clsx(purse && classes.noPadding, classes.select);
  const amountProps = useMemo(() => ({ inputProps: { min: 0 }}), []);
  const purseProps = useMemo(() => ({
    className: purseClass,
  }), [purseClass]);

  const handleAmountChange = useCallback(function handleAmountChange(ev) {
    onAmountChange(Number(ev.target.value));
    ev.preventDefault();
  }, [onAmountChange]);

  const handlePurseChange = useCallback(function handlePurseChange(ev) {
    onPurseChange(ev.target.value);
    ev.preventDefault();
  }, [onPurseChange]);

  return (
    <Grid container spacing={3}>
      <Grid item xs={6}>
        <TextField
          label={title}
          type="number"
          variant="outlined"
          fullWidth
          InputProps={amountProps}
          onChange={handleAmountChange}
          value={String(amount)}
          disabled={disabled}
          error={amountError}
        />
      </Grid>
      <Grid item xs={6}>
        <TextField
          select
          label={purseLabel}
          variant="outlined"
          fullWidth
          value={purse === null ? '' : purse}
          onChange={handlePurseChange}
          inputProps={purseProps}
          disabled={disabled}
          error={purseError}
        >
          {Array.isArray(purses) && purses.length > 0 ? (
            purses.map(({ pursePetname, issuerPetname, brandRegKey, extent }, i) =>
            brandRegKey === targetBrandRegKey && (
              <MenuItem key={pursePetname} value={purses[i]} divider>
                <ListItemText
                  primary={pursePetname}
                  secondary={`${extent} ${issuerPetname}`}
                />
              </MenuItem>
            ))
          ) : (
            <MenuItem key={null} value={null}>
              No purses
            </MenuItem>
          )}
        </TextField>
      </Grid>
    </Grid>
  );
}

/* eslint-enable react/prop-types */
