import Link from "next/link";
import { AdminControl, AdminField } from "../controls";
const assetPathPrefix = "/admin-assets";
const imgCleanPhotograph = `${assetPathPrefix}/955b4.png`;
const imgCleanPhotograph1 = `${assetPathPrefix}/984b1.png`;
const imgCleanPhotograph2 = `${assetPathPrefix}/a6d46.png`;
const imgBotanicalMark = `${assetPathPrefix}/5ed8c.svg`;
const imgWordmark = `${assetPathPrefix}/0ad4c.svg`;
export default function Component2702ProduceListingsQueue() {
  return (
    <div
      className="admin-element-ed8971f7b"
      data-node-id="2521:45556"
      data-name="27.02 · Produce listings queue"
    >
      <div className="admin-element-21a7647c1" data-node-id="2521:45557" data-name="Staff sidebar">
        <div
          className="admin-element-4fc05b874"
          data-node-id="2521:45558"
          data-name="Approved LeetLogic artwork"
        >
          <div
            className="admin-element-f84de7678"
            data-node-id="2521:45559"
            data-name="Botanical mark"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgBotanicalMark} />
          </div>
          <div className="admin-element-0cf7a046e" data-node-id="2521:45562" data-name="Wordmark">
            <img alt="" className="admin-element-8faf267d3" src={imgWordmark} />
          </div>
        </div>
        <p className="admin-element-1150e9f94" data-node-id="2521:45572">
          Operations portal
        </p>
        <div className="admin-element-ce079391e" data-node-id="2521:45573" data-name="Card">
          <p className="admin-element-1bc30747f" data-node-id="2521:45574">
            Amaka O.
          </p>
          <p
            className="admin-element-68e7d3268"
            data-node-id="2521:45575"
          >{`Operations & Finance`}</p>
        </div>
        <Link className="admin-element-f9528d997" data-node-id="2521:45576" href="/admin/dashboard">
          Dashboard
        </Link>
        <Link
          className="admin-element-f9528d997"
          data-node-id="2521:45577"
          href="/admin/verification"
        >
          Verification Queue
        </Link>
        <Link className="admin-element-f9528d997" data-node-id="2521:45578" href="/admin/listings">
          Listings Queue
        </Link>
        <Link
          className="admin-element-f9528d997"
          data-node-id="2521:45579"
          href="/admin/orders"
        >{`Orders & Escrow`}</Link>
        <Link
          className="admin-element-f9528d997"
          data-node-id="2521:45580"
          href="/admin/reconciliation"
        >
          Reconciliation
        </Link>
        <Link
          className="admin-element-f9528d997"
          data-node-id="2521:45581"
          href="/admin/withdrawals"
        >
          Withdrawals
        </Link>
        <Link className="admin-element-f9528d997" data-node-id="2521:45582" href="/admin/disputes">
          Dispute Queue
        </Link>
        <Link className="admin-element-f9528d997" data-node-id="2521:45583" href="/admin/users">
          Users
        </Link>
        <Link className="admin-element-f9528d997" data-node-id="2521:45584" href="/admin/audit">
          Audit Logs
        </Link>
        <Link className="admin-element-f9528d997" data-node-id="2521:45585" href="/admin/settings">
          Settings
        </Link>
        <p className="admin-element-1150e9f94" data-node-id="2521:45586">
          ● Ops Portal v2.4
        </p>
      </div>
      <div className="admin-element-2cccba0c3" data-node-id="2521:45587" data-name="Workspace">
        <div
          className="admin-element-bfa73d2c9"
          data-node-id="2521:45588"
          data-name="Staff toolbar"
        >
          <AdminField
            className="admin-element-79d519193"
            data-node-id="2521:45589"
            label="Search trade ref, seller ID, bank transaction..."
            search
          />
          <div
            className="admin-element-254931561"
            data-node-id="2521:45590"
            data-name="Status badge"
          >
            <p className="admin-element-649c0eb87" data-node-id="2521:45591">
              ● System Live
            </p>
          </div>
          <div
            className="admin-element-254931561"
            data-node-id="2521:45592"
            data-name="Status badge"
          >
            <p className="admin-element-649c0eb87" data-node-id="2521:45593">
              Lagos DC: 28ms
            </p>
          </div>
          <p className="admin-element-20d1cfadc" data-node-id="2521:45594">
            Amaka
          </p>
        </div>
        <div
          className="admin-element-255a14783"
          data-node-id="2521:45595"
          data-name="Workspace content"
        >
          <p className="admin-element-1a9fb554e" data-node-id="2521:45596">
            LeetLogic Operations
          </p>
          <p className="admin-element-8d85a98fe" data-node-id="2521:45597">
            Produce listings queue
          </p>
          <p className="admin-element-792987414" data-node-id="2521:45598">
            Review and approve pending farmer listings submitted from rural aggregation centers
            across Nigeria.
          </p>
          <div
            className="admin-element-7111b676c"
            data-node-id="2521:45599"
            data-name="Status badge"
          >
            <p className="admin-element-505396d32" data-node-id="2521:45600">
              SLA status: 18 listings pending · Average clearance time: 24 mins
            </p>
          </div>
          <p
            className="admin-element-792987414"
            data-node-id="2521:45601"
          >{`All listings 18 · Tomatoes & Veg 6 · Tubers & Grains 5 · Oil`}</p>
          <div className="admin-element-e5f5d3d21" data-node-id="2521:45602" data-name="Card">
            <div
              className="admin-element-68c9ec4e0"
              data-node-id="2521:45603"
              data-name="Listing moderation row"
            >
              <div
                className="admin-element-f92d144e4"
                data-node-id="2521:45604"
                data-name="Clean photograph"
              >
                <img alt="" className="admin-element-6c9f0a61a" src={imgCleanPhotograph} />
              </div>
              <div
                className="admin-element-a17bbffff"
                data-node-id="2521:45605"
                data-name="Content group"
              >
                <p className="admin-element-5bfbcad78" data-node-id="2521:45606">
                  Fresh Roma Tomatoes
                </p>
                <div
                  className="admin-element-7111b676c"
                  data-node-id="2521:45607"
                  data-name="Status badge"
                >
                  <p className="admin-element-505396d32" data-node-id="2521:45608">
                    Depot certified · Batch #LST-NG-7702
                  </p>
                </div>
                <p className="admin-element-792987414" data-node-id="2521:45609">
                  Harvest: Today, 06:30 AM
                </p>
                <p className="admin-element-792987414" data-node-id="2521:45610">
                  Chibuzor Simon · Abakaliki, Ebonyi State · Tier 1 verified
                </p>
              </div>
              <div
                className="admin-element-a17bbffff"
                data-node-id="2521:45611"
                data-name="Content group"
              >
                <p
                  className="admin-element-eb00a6706"
                  data-node-id="2521:45612"
                >{`Volume & valuation`}</p>
                <p className="admin-element-a284d738e" data-node-id="2521:45613">
                  ₦8,000 / big basket
                </p>
                <p className="admin-element-792987414" data-node-id="2521:45614">
                  40 baskets (Total: ₦320,000)
                </p>
                <div
                  className="admin-element-254931561"
                  data-node-id="2521:45615"
                  data-name="Status badge"
                >
                  <p className="admin-element-649c0eb87" data-node-id="2521:45616">
                    Pending review · Photos uploaded
                  </p>
                </div>
              </div>
              <div
                className="admin-element-e5b673564"
                data-node-id="2521:45617"
                data-name="Content group"
              >
                <p className="admin-element-3ab21a8ea" data-node-id="2521:45618">
                  Transit scope
                </p>
                <p
                  className="admin-element-82438c881"
                  data-node-id="2521:45619"
                >{`Local & inter-state · Aggregation hub: Ebonyi Central`}</p>
                <AdminControl
                  className="admin-element-3b377d908"
                  data-node-id="2521:45620"
                  data-name="Action"
                >
                  <div
                    className="admin-element-4713e3706"
                    data-node-id="I2521:45620;1:33891"
                    data-name="Button:shadow"
                  />
                  <div
                    className="admin-element-9a39a55c2"
                    data-node-id="I2521:45620;1:33892"
                    data-name="Container"
                  >
                    <div className="admin-element-a2a55dc42" data-node-id="I2521:45620;1:33893">
                      <p className="admin-element-f62dcabf0">Review listing →</p>
                    </div>
                  </div>
                </AdminControl>
              </div>
            </div>
          </div>
          <div className="admin-element-e5f5d3d21" data-node-id="2521:45621" data-name="Card">
            <div
              className="admin-element-68c9ec4e0"
              data-node-id="2521:45622"
              data-name="Listing moderation row"
            >
              <div
                className="admin-element-f92d144e4"
                data-node-id="2521:45623"
                data-name="Clean photograph"
              >
                <img alt="" className="admin-element-6c9f0a61a" src={imgCleanPhotograph1} />
              </div>
              <div
                className="admin-element-a17bbffff"
                data-node-id="2521:45624"
                data-name="Content group"
              >
                <p className="admin-element-5bfbcad78" data-node-id="2521:45625">
                  White Yams (Medium)
                </p>
                <div
                  className="admin-element-7111b676c"
                  data-node-id="2521:45626"
                  data-name="Status badge"
                >
                  <p className="admin-element-505396d32" data-node-id="2521:45627">
                    Phytosanitary logged · Batch #LST-NG-7698
                  </p>
                </div>
                <p className="admin-element-792987414" data-node-id="2521:45628">
                  Harvest: Yesterday
                </p>
                <p className="admin-element-792987414" data-node-id="2521:45629">
                  Ibrahim Musa · Zaria LGA, Kaduna State · Tier 2 verified
                </p>
              </div>
              <div
                className="admin-element-a17bbffff"
                data-node-id="2521:45630"
                data-name="Content group"
              >
                <p
                  className="admin-element-eb00a6706"
                  data-node-id="2521:45631"
                >{`Volume & valuation`}</p>
                <p className="admin-element-a284d738e" data-node-id="2521:45632">
                  ₦3,500 / tuber
                </p>
                <p className="admin-element-792987414" data-node-id="2521:45633">
                  150 tubers (Total: ₦525,000)
                </p>
                <div
                  className="admin-element-254931561"
                  data-node-id="2521:45634"
                  data-name="Status badge"
                >
                  <p className="admin-element-649c0eb87" data-node-id="2521:45635">
                    Pending review · Docs attached
                  </p>
                </div>
              </div>
              <div
                className="admin-element-e5b673564"
                data-node-id="2521:45636"
                data-name="Content group"
              >
                <p className="admin-element-3ab21a8ea" data-node-id="2521:45637">
                  Transit scope
                </p>
                <p
                  className="admin-element-82438c881"
                  data-node-id="2521:45638"
                >{`Nationwide & export · Ready for cargo staging`}</p>
                <AdminControl
                  className="admin-element-3b377d908"
                  data-node-id="2521:45639"
                  data-name="Action"
                >
                  <div
                    className="admin-element-4713e3706"
                    data-node-id="I2521:45639;1:33891"
                    data-name="Button:shadow"
                  />
                  <div
                    className="admin-element-9a39a55c2"
                    data-node-id="I2521:45639;1:33892"
                    data-name="Container"
                  >
                    <div className="admin-element-a2a55dc42" data-node-id="I2521:45639;1:33893">
                      <p className="admin-element-f62dcabf0">Review listing →</p>
                    </div>
                  </div>
                </AdminControl>
              </div>
            </div>
          </div>
          <div className="admin-element-e5f5d3d21" data-node-id="2521:45640" data-name="Card">
            <div
              className="admin-element-68c9ec4e0"
              data-node-id="2521:45641"
              data-name="Listing moderation row"
            >
              <div
                className="admin-element-f92d144e4"
                data-node-id="2521:45642"
                data-name="Clean photograph"
              >
                <img alt="" className="admin-element-6c9f0a61a" src={imgCleanPhotograph2} />
              </div>
              <div
                className="admin-element-a17bbffff"
                data-node-id="2521:45643"
                data-name="Content group"
              >
                <p className="admin-element-5bfbcad78" data-node-id="2521:45644">
                  Pure Owerri Red Palm Oil
                </p>
                <div
                  className="admin-element-7111b676c"
                  data-node-id="2521:45645"
                  data-name="Status badge"
                >
                  <p className="admin-element-505396d32" data-node-id="2521:45646">
                    Export marked · Batch #LST-NG-7691
                  </p>
                </div>
                <p className="admin-element-792987414" data-node-id="2521:45647">
                  Batch settled: Yesterday
                </p>
                <p className="admin-element-792987414" data-node-id="2521:45648">
                  Blessing Nwachukwu · Owerri West, Imo State
                </p>
              </div>
              <div
                className="admin-element-a17bbffff"
                data-node-id="2521:45649"
                data-name="Content group"
              >
                <p
                  className="admin-element-eb00a6706"
                  data-node-id="2521:45650"
                >{`Volume & valuation`}</p>
                <p className="admin-element-a284d738e" data-node-id="2521:45651">
                  ₦24,000 / 25L jerrycan
                </p>
                <p className="admin-element-792987414" data-node-id="2521:45652">
                  25 jerrycans (Total: ₦600,000)
                </p>
                <div
                  className="admin-element-254931561"
                  data-node-id="2521:45653"
                  data-name="Status badge"
                >
                  <p className="admin-element-649c0eb87" data-node-id="2521:45654">
                    Export review required
                  </p>
                </div>
              </div>
              <div
                className="admin-element-e5b673564"
                data-node-id="2521:45655"
                data-name="Content group"
              >
                <p className="admin-element-3ab21a8ea" data-node-id="2521:45656">
                  Transit scope
                </p>
                <p className="admin-element-82438c881" data-node-id="2521:45657">
                  Marked international export · Port Harcourt departure ready
                </p>
                <AdminControl
                  className="admin-element-3b377d908"
                  data-node-id="2521:45658"
                  data-name="Action"
                >
                  <div
                    className="admin-element-4713e3706"
                    data-node-id="I2521:45658;1:33891"
                    data-name="Button:shadow"
                  />
                  <div
                    className="admin-element-9a39a55c2"
                    data-node-id="I2521:45658;1:33892"
                    data-name="Container"
                  >
                    <div className="admin-element-a2a55dc42" data-node-id="I2521:45658;1:33893">
                      <p className="admin-element-f62dcabf0">Review listing →</p>
                    </div>
                  </div>
                </AdminControl>
              </div>
            </div>
          </div>
          <div className="admin-element-e5f5d3d21" data-node-id="2521:45659" data-name="Card">
            <div
              className="admin-element-68c9ec4e0"
              data-node-id="2521:45660"
              data-name="Listing moderation row"
            >
              <div
                className="admin-element-f92d144e4"
                data-node-id="2521:45661"
                data-name="Clean photograph"
              >
                <img alt="" className="admin-element-6c9f0a61a" src={imgCleanPhotograph} />
              </div>
              <div
                className="admin-element-a17bbffff"
                data-node-id="2521:45662"
                data-name="Content group"
              >
                <p className="admin-element-5bfbcad78" data-node-id="2521:45663">
                  Fresh Scotch Bonnet
                </p>
                <div
                  className="admin-element-7111b676c"
                  data-node-id="2521:45664"
                  data-name="Status badge"
                >
                  <p className="admin-element-505396d32" data-node-id="2521:45665">
                    Reshoot suggested · Batch #LST-NG-7685
                  </p>
                </div>
                <p className="admin-element-792987414" data-node-id="2521:45666">
                  Submitted: 2 hrs ago
                </p>
                <p className="admin-element-792987414" data-node-id="2521:45667">
                  Amina Bello · Kura LGA, Kano State
                </p>
              </div>
              <div
                className="admin-element-a17bbffff"
                data-node-id="2521:45668"
                data-name="Content group"
              >
                <p
                  className="admin-element-eb00a6706"
                  data-node-id="2521:45669"
                >{`Volume & valuation`}</p>
                <p className="admin-element-a284d738e" data-node-id="2521:45670">
                  ₦16,000 / bag
                </p>
                <p className="admin-element-792987414" data-node-id="2521:45671">
                  18 raffia bags (Total: ₦288,000)
                </p>
                <div
                  className="admin-element-254931561"
                  data-node-id="2521:45672"
                  data-name="Status badge"
                >
                  <p className="admin-element-649c0eb87" data-node-id="2521:45673">
                    Quality warning · Lighting check
                  </p>
                </div>
              </div>
              <div
                className="admin-element-e5b673564"
                data-node-id="2521:45674"
                data-name="Content group"
              >
                <p className="admin-element-3ab21a8ea" data-node-id="2521:45675">
                  Transit scope
                </p>
                <p className="admin-element-82438c881" data-node-id="2521:45676">
                  Regional direct (North-Central) · Standard cold-chain req
                </p>
                <AdminControl
                  className="admin-element-3b377d908"
                  data-node-id="2521:45677"
                  data-name="Action"
                >
                  <div
                    className="admin-element-4713e3706"
                    data-node-id="I2521:45677;1:33891"
                    data-name="Button:shadow"
                  />
                  <div
                    className="admin-element-9a39a55c2"
                    data-node-id="I2521:45677;1:33892"
                    data-name="Container"
                  >
                    <div className="admin-element-a2a55dc42" data-node-id="I2521:45677;1:33893">
                      <p className="admin-element-f62dcabf0">Review listing →</p>
                    </div>
                  </div>
                </AdminControl>
              </div>
            </div>
          </div>
          <div className="admin-element-a98cc3994" data-node-id="2521:45678" data-name="Card">
            <p className="admin-element-82438c881" data-node-id="2521:45679">
              Showing 1–4 of 18 pending listings · Page 1 of 5 · ‹ 1 2 3 ›
            </p>
            <p className="admin-element-82438c881" data-node-id="2521:45680">
              Selected: 1 listing (Fresh Roma Tomatoes by Chibuzor Simon)
            </p>
            <AdminControl
              className="admin-element-3b377d908"
              data-node-id="2521:45681"
              data-name="Action"
            >
              <div
                className="admin-element-4713e3706"
                data-node-id="I2521:45681;1:33891"
                data-name="Button:shadow"
              />
              <div
                className="admin-element-9a39a55c2"
                data-node-id="I2521:45681;1:33892"
                data-name="Container"
              >
                <div className="admin-element-a2a55dc42" data-node-id="I2521:45681;1:33893">
                  <p className="admin-element-f62dcabf0">Open review desk</p>
                </div>
              </div>
            </AdminControl>
          </div>
        </div>
      </div>
    </div>
  );
}
