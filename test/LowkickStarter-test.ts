import { loadFixture, ethers, expect, time } from "./setup";
import type { LowkickStarter } from "../typechain-types";
import { Campaign__factory } from "../typechain-types";

describe("LowkickStarter", function() {
    async function dep() {
        const [ owner, pledger ] = await ethers.getSigners();

        const LowkickStarterFactory = await ethers.getContractFactory("LowkickStarter");
        const lowkick: LowkickStarter = await LowkickStarterFactory.deploy();
        await lowkick.deployed();

        return { lowkick, owner, pledger }
    }

    it('campaign started', async function() {
        const { lowkick, owner } = await loadFixture(dep);

        const endsAt = Math.floor(Date.now() / 1000) + 30;
        const startTx = await lowkick.start(1000, endsAt);
        await startTx.wait();

        const campaign = await lowkick.campaigns(1);

        expect(campaign.targetContract).to.not.eq(0);
        expect(campaign.claimed).to.be.false;
        await expect(startTx).to.emit(lowkick, 'CampaignStarted').withArgs(1, endsAt, 1000, owner.address);
    });

    it('campaign starting with incorect goal', async function() {
        const { lowkick } = await loadFixture(dep);
        const endsAt = Math.floor(Date.now() / 1000) + 30;
        await expect(lowkick.start(0, endsAt)).to.be.revertedWith('incorrect goal');
    });

    it('campaign starting with small endsAt', async function() {
        const { lowkick } = await loadFixture(dep);
        const endsAt = Math.floor(Date.now() / 1000) - 30;
        await expect(lowkick.start(1000, endsAt)).to.be.revertedWith('incorrect endsAt');
    });

    it('campaign starting with big endsAt', async function() {
        const { lowkick } = await loadFixture(dep);
        const endsAt = Math.floor(Date.now() / 1000) + 30 + ethers.BigNumber.from(await lowkick.MAX_DURATION()).toNumber();
        await expect(lowkick.start(1000, endsAt)).to.be.revertedWith('incorrect endsAt');
    });

    it('onClaimed is access denied', async function() {
        const { lowkick } = await loadFixture(dep);
        await expect(lowkick.onClaimed(1)).to.be.revertedWith('access is denied');
    });

    it('campaign started', async function() {
        const { lowkick, owner } = await loadFixture(dep);

        const endsAt = Math.floor(Date.now() / 1000) + 30;
        const startTx = await lowkick.start(1000, endsAt);
        await startTx.wait();

        const campaign = await lowkick.campaigns(1);

        expect(campaign.targetContract).to.not.eq(0);
        expect(campaign.claimed).to.be.false;
        await expect(startTx).to.emit(lowkick, 'CampaignStarted').withArgs(1, endsAt, 1000, owner.address);
    });
  
    it('allows to pledge and claim', async function() {
        const { lowkick, owner, pledger } = await loadFixture(dep);

        const endsAt = Math.floor(Date.now() / 1000) + 30;
        const startTx = await lowkick.start(1000, endsAt);
        await startTx.wait();

        const campaignAddress = (await lowkick.campaigns(1)).targetContract;
        const campaignAsOwner = Campaign__factory.connect(campaignAddress, owner);

        expect(await campaignAsOwner.goal()).to.eq(1000);
        expect(await campaignAsOwner.endsAt()).to.eq(endsAt);
        expect(await campaignAsOwner.pledged()).to.eq(0);
        expect(await campaignAsOwner.id()).to.eq(1);
        expect(await campaignAsOwner.claimed()).to.be.false;
        expect(await campaignAsOwner.organizer()).to.eq(owner.address);

        const campaignAsPledger = Campaign__factory.connect(campaignAddress, pledger);

        await expect(campaignAsPledger.pledge()).to.be.revertedWith('not enough funds');

        const pledgeTx = await campaignAsPledger.pledge({value: 1500});
        await pledgeTx.wait();
        await expect(pledgeTx).to.emit(campaignAsPledger, 'Pledged').withArgs(1500, pledger.address);

        await expect(campaignAsPledger.refundPledge(2000)).to.be.revertedWith('not enough funds');

        const refundPledgeTx = await campaignAsPledger.refundPledge(500);
        await refundPledgeTx.wait();
        await expect(refundPledgeTx).to.emit(campaignAsPledger, 'RefundedPledge').withArgs(500, pledger.address);

        (await campaignAsPledger.pledge({value: 500})).wait();

        await expect(campaignAsPledger.claim()).to.be.revertedWith('access is denied');
        await expect(campaignAsOwner.claim()).to.be.revertedWith('time is not over');
        expect((await lowkick.campaigns(1)).claimed).to.be.false;

        await time.increase(40);

        await expect(campaignAsPledger.pledge()).to.be.revertedWith('time is over');
        await expect(campaignAsPledger.refundPledge(1000)).to.be.revertedWith('time is over');

        await expect(campaignAsPledger.fullRefund()).to.be.revertedWith('goal achieved');

        await expect(() => campaignAsOwner.claim()).to.changeEtherBalances([campaignAsOwner, owner], [-1500, 1500]);
        expect((await lowkick.campaigns(1)).claimed).to.be.true;

        await expect(campaignAsOwner.claim()).to.be.revertedWith('already claimed');
    });

    it('full refund', async function() {
        const { lowkick, owner, pledger } = await loadFixture(dep);

        const endsAt = Math.floor(Date.now() / 1000) + 30;
        const startTx = await lowkick.start(1000, endsAt);
        await startTx.wait();

        const campaignAddress = (await lowkick.campaigns(1)).targetContract;
        const campaignAsOwner = Campaign__factory.connect(campaignAddress, owner);

        const campaignAsPledger = Campaign__factory.connect(campaignAddress, pledger);

        (await campaignAsPledger.pledge({value: 900})).wait();

        await expect(campaignAsPledger.fullRefund()).to.be.revertedWith('time is not over');

        await time.increase(40);

        await expect(campaignAsOwner.claim()).to.be.revertedWith('goal not achieved');

        const fullRefundTx = await campaignAsPledger.fullRefund();
        await fullRefundTx.wait();
        await expect(fullRefundTx).to.emit(campaignAsPledger, 'FullRefund').withArgs(900, pledger.address);
    });
  });