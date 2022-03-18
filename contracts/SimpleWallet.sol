// SPDX-License-Identifier: GPL-3.0

pragma solidity =0.6.12;

import './uniswapv2/interfaces/IUniswapV2Pair.sol';
import './uniswapv2/interfaces/IUniswapV2Factory.sol';
import './uniswapv2/interfaces/IUniswapV2Router02.sol';

import './uniswapv2/interfaces/IERC20.sol';
import "hardhat/console.sol";

//import './uniswapv2/libraries/SafeMath.sol';

interface IMasterChef {
  function deposit(uint256 _pid, uint256 _amount) external;
}

contract SimpleWallet {

    //using SafeMathUniswap for uint;

    address public immutable factory;
    address public immutable router;
    address public immutable chef;

    constructor(address _router, address _chef) public {
        router = _router;
        chef = _chef;
        factory = IUniswapV2Router02(_router).factory();
    }

    // TODO: add ownable & withdraw

    // Adds liquidity and deposits LP tokens in only one step 
    function addLiquidityWithFarming(
        address _tokenA,
        address _tokenB,
        uint _amountADesired,
        uint _amountBDesired,
        uint _amountAMin,
        uint _amountBMin,
        uint _deadline,
        uint _masterChefPoolId
    ) external {
        uint amountA;
        uint amountB;
        uint liquidity;

        address pair = IUniswapV2Factory(factory).getPair(_tokenA, _tokenB);

        IERC20Uniswap(_tokenA).approve(router, IERC20Uniswap(_tokenA).balanceOf(address(this)));
        IERC20Uniswap(_tokenB).approve(router, IERC20Uniswap(_tokenB).balanceOf(address(this)));
        
        (amountA, amountB, liquidity) = IUniswapV2Router02(router).addLiquidity(_tokenA, _tokenB, _amountADesired, _amountBDesired, _amountAMin, _amountBMin, address(this), _deadline);

        IERC20Uniswap(pair).approve(chef, liquidity);
        IMasterChef(chef).deposit(_masterChefPoolId, liquidity);
    }

    // updates sushi rewards for farming pool
    function updateRewards(uint _poolId) external {
        IMasterChef(chef).deposit(_poolId, 0);
    }
}