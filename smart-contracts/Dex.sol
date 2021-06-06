pragma solidity ^0.8.0;
import './IERC20.sol';
contract Dex{
  struct Token{
    bytes32 ticker;
    address tokenAddress;
  }
  enum Side{ 
    BUY,
    SELL
  }
  struct Order{
    uint id;
    address trader;
    Side side;
    bytes32 ticker;
    uint amount;
    uint filled;
    uint price;
    uint date;
  }
  mapping(bytes32 => Token) public tokens;
  bytes32 [] public tokenList;
  address public admin;
  mapping (address => mapping(bytes32=>uint)) public traderBalances;
  mapping(bytes32=> mapping(uint =>Order[]))public orderBook;//enum will be casted into uint ie buy=0 sell=1
  uint public nextOrderId;
  uint public nextTradeId;
  bytes32 constant DAI = bytes32('DAI');
  event newTrade(
    uint tradeId,
    uint orderId,
    bytes32 indexed ticker,
    address indexed trader1,
    address indexed trader2,
    uint amount,
    uint price,
    uint date
  );
  constructor () {
    admin= msg.sender;
  }

  function addToken( 
    bytes32 ticker,
    address tokenAddress
  ) onlyAdmin external{
    tokens[ticker]= Token(ticker, tokenAddress);
    tokenList.push(ticker);
  }
  function deposit(
    uint amount,
    bytes32 ticker
  )  tokenExist(ticker) external{
    IERC20(tokens[ticker].tokenAddress).transferFrom(msg.sender, address(this), amount);
    traderBalances[msg.sender][ticker] +=amount;
  }
  function withdraw(
    uint amount,
    bytes32 ticker
  ) tokenExist(ticker) external{
    require(traderBalances[msg.sender][ticker] >= amount, "balance too low");
    traderBalances[msg.sender][ticker] -=amount;
    IERC20(tokens[ticker].tokenAddress).transfer(msg.sender, amount);

  }
  function createLimitOrder(
    bytes32 ticker,
    uint amount,
    uint price,
    Side side
  ) tokenExist(ticker) tokenIsNotDai(ticker) external {
    if (side == Side.SELL){
      require(traderBalances[msg.sender][ticker] >= amount,"token balance too low");
    }else{
      require(traderBalances[msg.sender][DAI] >= amount * price, "DAI balance too low");
    }
    Order [] storage orders = orderBook[ticker][uint(side)];
    orders.push(
      Order(
        nextOrderId,
        msg.sender,
        side,
        ticker,
        amount,
        0,
        price,
        block.timestamp
      )
    );
    //bubble sort algorithm to sort orders buy(descending), sell(ascending)
    uint i = orders.length - 1;
    while(i < 0){
      if(side == Side.BUY && orders[i-1].price > orders[i].price){
        //stopping condition
        break;
      }
      if(side == Side.SELL && orders[i-1].price < orders[i].price){
        //stopping condition
        break;
      }
      Order memory order = orders[i-1];
      orders[i-1] =orders[i];
      orders[i] = order;
      i--;
    }
    nextOrderId++;
  }
  function createMarketOrder(
    bytes32 ticker,
    uint amount,
    Side side
  )tokenExist(ticker) 
  tokenIsNotDai(ticker) 
  external {
   if (side == Side.SELL){
      require(traderBalances[msg.sender][ticker] >= amount,"token balance too low");
    }
    Order [] storage orders =orderBook[ticker][uint(side == Side.BUY ? Side.SELL : Side.BUY)];
    uint i;
    uint remaining = amount;
    while(i < orders.length && remaining >0 ){
      uint available = orders[i].amount - orders[i].filled;
      uint matched = (remaining > available) ? available : remaining;
      remaining -= matched;
      orders[i].filled += matched;
      emit  newTrade(nextTradeId, orders[i].id, ticker, orders[i].trader, msg.sender, matched, orders[i].price, block.timestamp);
       if(side == Side.SELL){
      traderBalances[msg.sender][ticker]-= matched;
      traderBalances[msg.sender][DAI]+= matched * orders[i].price;
      traderBalances[orders[i].trader][DAI]-= matched * orders[i].price;
      traderBalances[orders[i].trader][ticker]+= matched;
      }
      if(side == Side.BUY){
        require(traderBalances[msg.sender][DAI]>= matched * orders[i].price, "DAI balance too low");
        traderBalances[msg.sender][ticker]+= matched;
        traderBalances[msg.sender][DAI]-= matched * orders[i].price;
        traderBalances[orders[i].trader][DAI]+= matched * orders[i].price;
        traderBalances[orders[i].trader][ticker]-= matched;
      }
      nextTradeId++;
      i++;
    }
    //while loop to remove all matched orders from order book.
    i=0;
    while(i < orders.length && orders[i].filled == orders[i].amount){
      //the orders at the beginning of the orders array get filled first
      // if any orders will be empty, it will be those at the beginning because orders at the beginning get filled first
      //this algorithm checks order at postion 0, if it is filled, it swaps postion 1 into zero, on and on till the last element
      for(uint j =i; j< orders.length -1; j++){
        orders[j]= orders[j+1];
      }
      orders.pop();
      i++;
    }
   
  } 
  modifier onlyAdmin(){
    require(msg.sender == admin, "only admin allowed");
    _;
  }
  modifier tokenExist(bytes32 ticker){
    require(tokens[ticker].tokenAddress != address(0), "this token does not exist");
    _;
  }
  modifier tokenIsNotDai(bytes32 ticker){
  require(ticker != DAI, "cannot buy or sell DAI");
  _;
}
//end of contract
}
