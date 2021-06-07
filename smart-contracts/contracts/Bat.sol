pragma solidity ^0.8.0;
import "./ERC20.sol";
//SPDX-License-Identifier: UNLICENSED
contract  Bat  is ERC20{
  constructor () ERC20('BAT', 'Brave browser token') { }
  
  function faucet(address account, uint256 amount) public virtual  returns (bool){
    _mint(account, amount);
    return true;
  }
}