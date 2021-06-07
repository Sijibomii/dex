const { expectRevert }= require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const Dai = artifacts.require('../contracts/Dai.sol');
const Bat = artifacts.require('../contracts/Bat.sol');
const Rep = artifacts.require('../contracts/Rep.sol');
const Zrx = artifacts.require('../contracts/Zrx.sol');
const Dex = artifacts.require('../contracts/Dex.sol');

const SIDE={
  BUY: 0,
  SELL:1
}
contract('Dex',(accounts)=>{
  let dai, bat, rep, zrx,dex;
  const [trader1, trader2] =[accounts[1], accounts[2]];
  const [DAI, BAT, REP, ZRX]=['DAI', 'BAT', 'REP', 'ZRX'].map((ticker)=> web3.utils.fromAscii(ticker));
  beforeEach(async ()=>{
    ([dai, bat, rep, zrx]=await Promise.all([
      Dai.new(),
      Bat.new(),
      Rep.new(),
      Zrx.new()
    ]));
     dex = await Dex.new();
    // add tokens to our dex
    await Promise.all([
      dex.addToken(DAI,dai.address),
      dex.addToken(BAT,bat.address),
      dex.addToken(REP,rep.address),
      dex.addToken(ZRX,zrx.address),
    ]);
    const amount = web3.utils.toWei('1000');
    const seedTokenBalance  = async (token, trader)=>{
      //this seeds a token balance to trader1 and trader2 address before any test
      await token.faucet(trader, amount);
      //this allows our dex contract to move tokens seeded to each trader on their behalf.
      await token.approve(
        dex.address,
        amount,
        { from : trader}
      );
    };
    await Promise.all(
      [dai, bat, rep, zrx].map(token=> seedTokenBalance(token, trader1 ))
    );
    await Promise.all(
      [dai, bat, rep, zrx].map(token=> seedTokenBalance(token, trader2 ))
    );
  });
    it('should deposit tokens', async ()=>{
      const amount = web3.utils.toWei('100');
      //trader1 deposits some seeded dai to our contract
      await dex.deposit(
        amount,
        DAI,
        {from: trader1}
      );
      const balance= await dex.traderBalances(trader1, DAI);
      assert(balance.toString() === amount);
    });
    it('should not deposit deposit unregistered token', async()=>{
      await expectRevert(
        dex.deposit(
          web3.utils.toWei('100'),
          web3.utils.fromAscii('UNKOWN_TOKEN'),
          {from: trader1}
        ),
        'this token does not exist'
      );
    });
    it('should withdraw tokens', async()=>{
      const amount = web3.utils.toWei('100');
      await dex.deposit(
        amount,
        DAI,
        {from: trader1}
      );
      await dex.withdraw(
        amount,
        DAI,
        { from: trader1 }
      );
      const [balanceDex, balanceDai]=await Promise.all([
        dex.traderBalances(trader1, DAI),
        dai.balanceOf(trader1)
      ]);
      assert(balanceDex.isZero());
      console.log(balanceDai.toString())
      //assert(balanceDai.toString() == web3.utils.toWei('100'));
    });
    it('should not withdraw unregistered tokens', async()=>{
      await expectRevert(
        dex.withdraw(
          web3.utils.toWei('100'),
          web3.utils.fromAscii('UNKOWN_TOKEN'),
          {from: trader1}
        ),
        'this token does not exist'
      );
    });
    it('should not withdraw tokens if balance is too low', async()=>{
      const amount = web3.utils.toWei('100');
      await dex.deposit(
        amount,
        DAI,
        {from: trader1}
      );
      await expectRevert(
       dex.withdraw(
        web3.utils.toWei('1000'),
        DAI,
        { from: trader1 }
      ), 'balance too low');
    });
    it('should create limit order', async()=>{
      const amount = web3.utils.toWei('100');
      await dex.deposit(
        amount,
        DAI,
        {from: trader1}
      );
      await dex.createLimitOrder(
        REP,
        web3.utils.toWei('10'),
        10,
        SIDE.BUY,//specify the side of the limit order
        {from: trader1}
      );
      const buyOrders = await dex.getorders(REP, SIDE.BUY);
      const sellOrders= await dex.getorders(REP, SIDE.SELL);
      assert(buyOrders.length === 1);
      assert(buyOrders[0].trader === trader1);
      assert(buyOrders[0].ticker === web3.utils.padRight(REP, 64));//the bytes32 the contract returns will be padded apparently, don't ask me why
      assert(buyOrders[0].price === '10');
      assert(buyOrders[0].amount === web3.utils.toWei('10'),);
      assert(sellOrders.length === 0);

      //add new order
      await dex.deposit(
        web3.utils.toWei('200'),
        DAI,
        { from: trader2} 
      );
      await dex.createLimitOrder(
        REP,
        web3.utils.toWei('10'),
        11,
        SIDE.BUY,
        {from: trader2}
      );
       buyOrders = await dex.getorders(REP, SIDE.BUY);
       sellOrders= await dex.getorders(REP, SIDE.SELL);
       assert(buyOrders.length === 2);
       assert(buyOrders[0].trader === trader2);//order of trader to should have been pushed to the beginning bc it has a better price
       assert(buyOrders[1].trader === trader1);//trader1's order should now be behind
       assert(buyOrders[0].amount === web3.utils.toWei('10'));
       assert(sellOrders.length === 0);
    });
});