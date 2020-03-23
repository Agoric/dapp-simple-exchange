import React from 'react';

import {
  Card,
  CardHeader,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  makeStyles,
} from '@material-ui/core';
import PurseIcon from '@material-ui/icons/BusinessCenter';

import { useApplicationContext } from '../contexts/Application';

const useStyles = makeStyles(theme => ({
  icon: {
    minWidth: 24,
    marginRight: theme.spacing(2),
  },
}));

export default function Wallet() {
  const { state } = useApplicationContext();
  const { purses } = state;
  const classes = useStyles();

  return (
    <Card elevation={0}>
      <CardHeader title="Wallet Balance" />
      <Divider />

      <List>
        {Array.isArray(purses) && purses.length > 0 ? (
          purses.map(({ pursePetname, issuerPetname, brandRegKey, extent }) => (
            <ListItem key={pursePetname} value={pursePetname} divider>
              <ListItemIcon className={classes.icon}>
                <PurseIcon />
              </ListItemIcon>
              <ListItemText
                primary={pursePetname}
                secondary={<><b>{extent} {issuerPetname}</b> <i>({brandRegKey})</i></>}
              />
            </ListItem>
          ))
        ) : (
          <ListItem key={null} value={null}>
            No purses.
          </ListItem>
        )}
      </List>
    </Card>
  );
}
