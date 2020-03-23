import React, { useEffect } from 'react';

import { makeStyles } from '@material-ui/core/styles';

import {
  Card,
  CardHeader,
  Divider,
  TableContainer,
  TablePagination,
  Table,
  TableHead,
  TableBody,
  TableFooter,
  TableRow,
  TableCell,
  Typography,
} from '@material-ui/core';

import { useApplicationContext } from '../contexts/Application';

const useStyles = makeStyles(theme => ({
  buy: {
    color: theme.palette.success.main,
  },
  sell: {
    color: theme.palette.warning.main,
  },
}));

export default function OrderHistory() {
  const classes = useStyles();
  const { state } = useApplicationContext();
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(25);
  const [history, setHistory] = React.useState([]);
  const { orderhistory, assetBrandRegKey, priceBrandRegKey } = state;

  useEffect(() => {
    const result = [];
    orderhistory.buy.forEach(item => result.push({ side: true, ...item }));
    orderhistory.sell.forEach(item => result.push({ side: false, ...item }));
    setHistory(result);
  }, [orderhistory]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = event => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  function getRate(order, decimal) {
    return (order[order.side ? 'Asset' : 'Price'].extent /
      order[order.side ? 'Price' : 'Asset'].extent).toFixed(decimal);
  }

  function getClass(order) {
    return order.side === true ? classes.buy : classes.sell;
  }


  const tablePagination = <TablePagination
    rowsPerPageOptions={[
      25,
      50,
      100,
      { label: 'All', value: -1 },
    ]}
    count={history.length}
    rowsPerPage={rowsPerPage}
    page={page}
    onChangePage={handleChangePage}
    onChangeRowsPerPage={handleChangeRowsPerPage}
  />

  return (
    <Card elevation={0}>
      <CardHeader title="Order History" />
      <Divider />
      {Array.isArray(history) && history.length > 0 ? (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {tablePagination}
              </TableRow>
              <TableRow>
                <TableCell align="right">Side</TableCell>
                <TableCell align="right">Give</TableCell>
                <TableCell align="right">Want</TableCell>
                <TableCell align="right">Rate</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .filter(({ Asset: { brandRegKey: AssetBrandRegKey }, Price: { brandRegKey: PriceBrandRegKey } }) =>
                  AssetBrandRegKey === assetBrandRegKey && PriceBrandRegKey === priceBrandRegKey)
                .map(order => (
                  <TableRow key={order.publicID}>
                    <TableCell align="right" className={getClass(order)}>
                      {order.side ? 'Buy' : ' Sell'}
                    </TableCell>
                    <TableCell align="right">{order[order.side ? 'Asset' : 'Price'].extent}</TableCell>
                    <TableCell align="right">{getRate(order, 4)}</TableCell>
                    <TableCell align="right">{order[order.side ? 'Price' : 'Asset'].extent}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                {tablePagination}
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      ) : (
        <Typography color="inherit">No completed orders.</Typography>
      )}
    </Card>
  );
}
