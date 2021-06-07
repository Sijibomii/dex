pragma solidity ^0.8.0;
import "./ERC20.sol";
//SPDX-License-Identifier: UNLICENSED
contract  Zrx  is ERC20{
  constructor () ERC20('ZRX', '0x token') { }
  
  function faucet(address account, uint256 amount) public virtual  returns (bool){
    _mint(account, amount);
    return true;
  }
}