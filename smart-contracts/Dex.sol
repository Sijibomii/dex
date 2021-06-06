pragma solidity ^0.8.0;
import './IERC20.sol';
contract Dex{
  struct Token{
    bytes32 ticker;
    address tokenAddress;
  }
  mapping(bytes32 => Token) public tokens;
  bytes32 [] public tokenList;
  address public admin;
  mapping (address => mapping(bytes32=>uint)) public traderBalances;
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
  modifier onlyAdmin(){
    require(msg.sender == admin, "only admin allowed");
    _;
  }
  modifier tokenExist(bytes32 ticker){
    require(tokens[ticker].tokenAddress != address(0), "this token does not exist");
    _;
  }
}