// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './Campaign.sol';

contract LowkickStarter {
    struct LowkickCampaign {
        Campaign targetContract;
        bool claimed;
    }
    mapping (uint => LowkickCampaign) public campaigns;
    uint private currentCampaign;
    address public owner;
    uint constant public MAX_DURATION = 30 days;

    event CampaignStarted(uint indexed id, uint endsAt, uint goal, address organizer);
    event OnClaimed(uint indexed id);

    function start(uint _goal, uint _endsAt) external {
        require(_goal > 0, 'incorrect goal');
        require(_endsAt <= block.timestamp + MAX_DURATION && _endsAt > block.timestamp, 'incorrect endsAt');

        currentCampaign++;

        campaigns[currentCampaign] = LowkickCampaign({
            targetContract: new Campaign(_endsAt, _goal, msg.sender, currentCampaign),
            claimed: false
        });

        emit CampaignStarted(currentCampaign, _endsAt, _goal, msg.sender);
    }

    function onClaimed(uint _id) external {
        LowkickCampaign storage targetCampaign = campaigns[_id];

        require(msg.sender == address(targetCampaign.targetContract), 'access is denied');
        targetCampaign.claimed = true;

        emit OnClaimed(_id);
    }
}