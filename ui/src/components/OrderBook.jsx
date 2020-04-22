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

const useStyles = makeStyles(theme => ({
  buy: {
    color: theme.palette.success.main,
  },
  sell: {
    color: theme.palette.warning.main,
  },
}));

export default function OrderBook({ title, orderbook, orderBookKind}) {
  const classes = useStyles();
  const [orders, setOrders] = React.useState([]);

  useEffect(() => {
    const result = [];

    if (orderbook.buy) {
      orderbook.buy.forEach(item => result.push({ side: true, ...item }));
    }
    if (orderbook.sell) {
      orderbook.sell.forEach(item => result.push({ side: false, ...item }));
    }
    setOrders(result);
  }, [orderbook]);

  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(25);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = event => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  function getRate(order, decimal) {
    return (order.Price.extent / order.Asset.extent).toFixed(decimal);
  }

  function getClass(order) {
    return order.side ? classes.buy : classes.sell;
  }

  const tablePagination = <TablePagination
    rowsPerPageOptions={[
      25,
      50,
      100,
      { label: 'All', value: -1 },
    ]}
    count={orders.length}
    rowsPerPage={rowsPerPage}
    page={page}
    onChangePage={handleChangePage}
    onChangeRowsPerPage={handleChangeRowsPerPage}
  />;

  return (
    <Card elevation={0}>
      <CardHeader title={title} />
      <Divider />
      {Array.isArray(orders) && orders.length > 0 ? (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {tablePagination}
              </TableRow>
              <TableRow>
                <TableCell align="right">Side</TableCell>
                <TableCell align="right">Give</TableCell>
                <TableCell align="right">Rate</TableCell>
                <TableCell align="right">Want</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .filter(({ Asset: { keyword: assetKeyWord }, Price: { keyword: priceKeyword } }) =>
                  assetKeyWord === 'Asset' && priceKeyword === 'Price')
                .map(order => (
                  <TableRow key={order.publicID}>
                    <TableCell align="right" className={getClass(order)}>{order.state === 'cancelled' ? 'Cancel' : order.side ? 'Buy' : 'Sell'}</TableCell>
                    <TableCell align="right">{order[order.side ? 'Price' : 'Asset'].extent}</TableCell>
                    <TableCell align="right" className={getClass(order)}>
                      {getRate(order, 4)}
                    </TableCell>
                    <TableCell align="right">{order[order.side ? 'Asset' : 'Price'].extent}</TableCell>
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
        <Typography color="inherit">No {orderBookKind} orders.</Typography>
      )}
    </Card>
  );
}
