import Link from "next/link";
import { AdminControl, AdminField } from "../controls";
const assetPathPrefix = "/admin-assets";
const imgFlag01 = `${assetPathPrefix}/f9316.svg`;
const imgBotanicalMark = `${assetPathPrefix}/67377.svg`;
const imgWordmark = `${assetPathPrefix}/0ad4c.svg`;
const imgShieldCheck = `${assetPathPrefix}/3d049.svg`;
const imgLayoutGrid = `${assetPathPrefix}/d3ab6.svg`;
const imgDelivery = `${assetPathPrefix}/0bac5.svg`;
const imgLayoutGrid1 = `${assetPathPrefix}/5d284.svg`;
const imgBell = `${assetPathPrefix}/ec39a.svg`;
const imgShieldCheck1 = `${assetPathPrefix}/76feb.svg`;
const imgSprout = `${assetPathPrefix}/734de.svg`;
type LeetlogicIOsReceivedMessageProps = {
  className?: string;
  children?: React.ReactNode | null;
};
function LeetlogicIOsReceivedMessage({
  className,
  children = null,
}: LeetlogicIOsReceivedMessageProps) {
  return (
    <div
      className={className || "admin-element-34228469d"}
      data-node-id="2521:20834"
      data-name="Leetlogic iOS / Received message"
    >
      <div className="admin-element-032a23d0e" data-node-id="2521:20835" data-name="Content">
        {children || (
          <>
            <div
              className="admin-element-452d34671"
              data-node-id="2521:20836"
              data-name="Message bubble"
            >
              <div
                className="admin-element-2c53a1857"
                data-node-id="I2521:20836;1242:974"
                data-name="Content"
              >
                <div
                  className="admin-element-c24bb60d2"
                  data-node-id="I2521:20836;1242:976"
                  data-name="Input"
                >
                  <p
                    className="admin-element-79d6a44eb"
                    data-node-id="I2521:20836;1242:979"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Can you transfer directly to my OPay account so we avoid the charges?
                  </p>
                </div>
              </div>
            </div>
            <div
              className="admin-element-3af50ae4b"
              data-node-id="2521:20837"
              data-name="Message status"
            >
              <p
                className="admin-element-53ac6d9ed"
                data-node-id="2521:20838"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                10:15 AM
              </p>
              <div
                className="admin-element-c490d6ecc"
                data-node-id="2521:20839"
                data-name="Risk flag"
              >
                <div
                  className="admin-element-b78480325"
                  data-node-id="2521:20840"
                  data-name="flag-01"
                >
                  <img alt="" className="admin-element-8faf267d3" src={imgFlag01} />
                </div>
                <p
                  className="admin-element-bf732407a"
                  data-node-id="2521:20841"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  High risk
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
export default function Component2104LiveChatConsole() {
  return (
    <div
      className="admin-element-ed8971f7b"
      data-node-id="2521:43702"
      data-name="21.04 · Live chat console"
    >
      <div className="admin-element-52c1e5d35" data-node-id="2521:43703" data-name="Staff sidebar">
        <div
          className="admin-element-4fc05b874"
          data-node-id="2521:43704"
          data-name="Approved LeetLogic logo"
        >
          <div
            className="admin-element-f84de7678"
            data-node-id="2521:43705"
            data-name="Botanical mark"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgBotanicalMark} />
          </div>
          <div className="admin-element-0cf7a046e" data-node-id="2521:43708" data-name="Wordmark">
            <img alt="" className="admin-element-8faf267d3" src={imgWordmark} />
          </div>
        </div>
        <p
          className="admin-element-31e02e224"
          data-node-id="2521:43718"
          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
        >
          Admin Portal
        </p>
        <div className="admin-element-0f896c36f" data-node-id="2521:43719" data-name="Notice">
          <div
            className="admin-element-eaa60f1c4"
            data-node-id="2521:43720"
            data-name="shield-check"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgShieldCheck} />
          </div>
          <div className="admin-element-b8d938929" data-node-id="2521:43722" data-name="Guidance">
            <p
              className="admin-element-fc65763f1"
              data-node-id="2521:43723"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Amaka
            </p>
            <Link
              className="admin-element-5a7d6aeb8"
              data-node-id="2521:43724"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/support"
            >
              Operations / Support Officer
            </Link>
          </div>
        </div>
        <div
          className="admin-element-c94ed62b9"
          data-node-id="2521:43725"
          data-name="Staff navigation"
        >
          <div
            className="admin-element-680c79a38"
            data-node-id="2521:43726"
            data-name="Navigation item"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:43727"
              data-name="layout-grid"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid} />
            </div>
            <Link
              className="admin-element-52d21bb93"
              data-node-id="2521:43729"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/dashboard"
            >
              Dashboard
            </Link>
          </div>
          <div
            className="admin-element-680c79a38"
            data-node-id="2521:43730"
            data-name="Navigation item"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:43731"
              data-name="layout-grid"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid} />
            </div>
            <Link
              className="admin-element-52d21bb93"
              data-node-id="2521:43733"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/verification"
            >
              Verification Queue
            </Link>
          </div>
          <div
            className="admin-element-680c79a38"
            data-node-id="2521:43734"
            data-name="Navigation item"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:43735"
              data-name="layout-grid"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid} />
            </div>
            <Link
              className="admin-element-52d21bb93"
              data-node-id="2521:43737"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/listings"
            >
              Listings
            </Link>
          </div>
          <Link
            className="admin-element-680c79a38"
            data-node-id="2521:43738"
            data-name="Navigation item"
            href="/admin/orders"
          >
            <div className="admin-element-b2a182ecf" data-node-id="2521:43739" data-name="Delivery">
              <img alt="" className="admin-element-8faf267d3" src={imgDelivery} />
            </div>
            <span
              className="admin-element-52d21bb93"
              data-node-id="2521:43740"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >{`Orders & Logistics`}</span>
          </Link>
          <div
            className="admin-element-680c79a38"
            data-node-id="2521:43741"
            data-name="Navigation item"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:43742"
              data-name="layout-grid"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid} />
            </div>
            <Link
              className="admin-element-52d21bb93"
              data-node-id="2521:43744"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/users"
            >
              Users
            </Link>
          </div>
          <Link
            className="admin-element-680c79a38"
            data-node-id="2521:43745"
            data-name="Navigation item"
            href="/admin/disputes"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:43746"
              data-name="layout-grid"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid} />
            </div>
            <span
              className="admin-element-52d21bb93"
              data-node-id="2521:43748"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >{`Disputes & Tickets`}</span>
          </Link>
          <Link
            className="admin-element-e6503ba75"
            data-node-id="2521:43749"
            data-name="Navigation item"
            href="/admin/support/chat"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:43750"
              data-name="layout-grid"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid1} />
            </div>
            <span
              className="admin-element-ab50075fc"
              data-node-id="2521:43752"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Live Chat Console
            </span>
          </Link>
          <div
            className="admin-element-680c79a38"
            data-node-id="2521:43753"
            data-name="Navigation item"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:43754"
              data-name="layout-grid"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid} />
            </div>
            <Link
              className="admin-element-52d21bb93"
              data-node-id="2521:43756"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/risk"
            >{`Fraud & Risk`}</Link>
          </div>
          <Link
            className="admin-element-680c79a38"
            data-node-id="2521:43757"
            data-name="Navigation item"
            href="/admin/translations"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:43758"
              data-name="layout-grid"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid} />
            </div>
            <span
              className="admin-element-52d21bb93"
              data-node-id="2521:43760"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >{`Localization & Translations`}</span>
          </Link>
          <Link
            className="admin-element-680c79a38"
            data-node-id="2521:43761"
            data-name="Navigation item"
            href="/admin/settings"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:43762"
              data-name="layout-grid"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid} />
            </div>
            <span
              className="admin-element-52d21bb93"
              data-node-id="2521:43764"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Staff Settings
            </span>
          </Link>
        </div>
        <p
          className="admin-element-66df30e07"
          data-node-id="2521:43765"
          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
        >
          ● Ops Portal v2.4
        </p>
      </div>
      <div className="admin-element-3d7de8083" data-node-id="2521:43766" data-name="Workspace">
        <div
          className="admin-element-ecfad9b8a"
          data-node-id="2521:43767"
          data-name="Staff toolbar"
        >
          <div className="admin-element-311e6f066" data-node-id="2521:43768" data-name="Status">
            <p
              className="admin-element-c5601f4a4"
              data-node-id="2521:43769"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              ● Systems Normal · 99.98%
            </p>
          </div>
          <p
            className="admin-element-6408cdf1a"
            data-node-id="2521:43770"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >
            ⌕ Search ID, merchant, ticket, or batch...
          </p>
          <div className="admin-element-eaa60f1c4" data-node-id="2521:43771" data-name="bell">
            <img alt="" className="admin-element-8faf267d3" src={imgBell} />
          </div>
          <p
            className="admin-element-7047931a8"
            data-node-id="2521:43773"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >
            Amaka O. · Shift Lead
          </p>
        </div>
        <div
          className="admin-element-597aaf720"
          data-node-id="2521:43774"
          data-name="Workspace content"
        >
          <div className="admin-element-47aacf6d1" data-node-id="2521:43775" data-name="Details">
            <p className="admin-element-613f8d8d4" data-node-id="2521:43776">
              Live Chat Console
            </p>
            <div className="admin-element-392f38cb7" data-node-id="2521:43777" data-name="Status">
              <p
                className="admin-element-1b81774f5"
                data-node-id="2521:43778"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Desk Live
              </p>
            </div>
            <div className="admin-element-311e6f066" data-node-id="2521:43779" data-name="Status">
              <p
                className="admin-element-c5601f4a4"
                data-node-id="2521:43780"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Escrow Shield Mode: Enforced
              </p>
            </div>
          </div>
          <div className="admin-element-0f896c36f" data-node-id="2521:43781" data-name="Notice">
            <div
              className="admin-element-eaa60f1c4"
              data-node-id="2521:43782"
              data-name="shield-check"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgShieldCheck} />
            </div>
            <div className="admin-element-b8d938929" data-node-id="2521:43784" data-name="Guidance">
              <p
                className="admin-element-fc65763f1"
                data-node-id="2521:43785"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Amaka Okonkwo · Online (Taking Chats)
              </p>
              <p
                className="admin-element-5a7d6aeb8"
                data-node-id="2521:43786"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Avg. Response: 42s
              </p>
            </div>
          </div>
          <div
            className="admin-element-c93a8f5ce"
            data-node-id="2521:43787"
            data-name="Live support workspace"
          >
            <div
              className="admin-element-6c3fa5f9a"
              data-node-id="2521:43788"
              data-name="Chat queue"
            >
              <div className="admin-element-a00cb0fe2" data-node-id="2521:43789" data-name="Card">
                <p
                  className="admin-element-0a7811f61"
                  data-node-id="2521:43790"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ⌕ Search queue, ID, or name
                </p>
                <p
                  className="admin-element-7e61928b7"
                  data-node-id="2521:43791"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Queue (4) · SLA Alert: 0
                </p>
                <div className="admin-element-501832583" data-node-id="2521:43792" data-name="Card">
                  <p
                    className="admin-element-7e61928b7"
                    data-node-id="2521:43793"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Tunde Balogun
                  </p>
                  <p
                    className="admin-element-9f0e00559"
                    data-node-id="2521:43794"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    10:16 AM
                  </p>
                  <p
                    className="admin-element-00ffde69f"
                    data-node-id="2521:43795"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Buyer · Lagos · Yam order
                  </p>
                  <p
                    className="admin-element-2340158b1"
                    data-node-id="2521:43796"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Active · Typing... · High Priority
                  </p>
                </div>
                <div className="admin-element-14fe29945" data-node-id="2521:43797" data-name="Card">
                  <p
                    className="admin-element-7e61928b7"
                    data-node-id="2521:43798"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Maryam Usman
                  </p>
                  <p
                    className="admin-element-9f0e00559"
                    data-node-id="2521:43799"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    10:02 AM
                  </p>
                  <p
                    className="admin-element-00ffde69f"
                    data-node-id="2521:43800"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Delivery status for sorghum
                  </p>
                  <p
                    className="admin-element-2340158b1"
                    data-node-id="2521:43801"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    In transit · Kano Depot
                  </p>
                </div>
                <div className="admin-element-14fe29945" data-node-id="2521:43802" data-name="Card">
                  <p
                    className="admin-element-7e61928b7"
                    data-node-id="2521:43803"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Emeka Kalu
                  </p>
                  <p
                    className="admin-element-9f0e00559"
                    data-node-id="2521:43804"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    09:48 AM
                  </p>
                  <p
                    className="admin-element-00ffde69f"
                    data-node-id="2521:43805"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Withdrawal question to GTBank
                  </p>
                  <p
                    className="admin-element-2340158b1"
                    data-node-id="2521:43806"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Payout query
                  </p>
                </div>
                <div className="admin-element-14fe29945" data-node-id="2521:43807" data-name="Card">
                  <p
                    className="admin-element-7e61928b7"
                    data-node-id="2521:43808"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Ngozi Peters
                  </p>
                  <p
                    className="admin-element-9f0e00559"
                    data-node-id="2521:43809"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    09:30 AM
                  </p>
                  <p
                    className="admin-element-00ffde69f"
                    data-node-id="2521:43810"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Bulk order inquiry for cassava
                  </p>
                  <p
                    className="admin-element-2340158b1"
                    data-node-id="2521:43811"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Tier 1 Trade Inquiry
                  </p>
                </div>
                <p
                  className="admin-element-00ffde69f"
                  data-node-id="2521:43812"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Shift Handled: 19 · Resolution Rate: 94%
                </p>
              </div>
            </div>
            <div
              className="admin-element-7c219a7f7"
              data-node-id="2521:43813"
              data-name="Active support conversation"
            >
              <div className="admin-element-14fe29945" data-node-id="2521:43814" data-name="Card">
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:43815"
                  data-name="Details"
                >
                  <p className="admin-element-dc457dde4" data-node-id="2521:43816">
                    Tunde Balogun
                  </p>
                  <div
                    className="admin-element-392f38cb7"
                    data-node-id="2521:43817"
                    data-name="Status"
                  >
                    <p
                      className="admin-element-1b81774f5"
                      data-node-id="2521:43818"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      #BYR-2490
                    </p>
                  </div>
                </div>
                <p
                  className="admin-element-e1a117fc5"
                  data-node-id="2521:43819"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Linked Order: #LL-9014 (Yams, ₦48,000)
                </p>
                <p
                  className="admin-element-f13c8c588"
                  data-node-id="2521:43820"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  +234 814 550 1199 · Verified Buyer
                </p>
                <div
                  className="admin-element-780cdc4b9"
                  data-node-id="2521:43821"
                  data-name="Notice"
                >
                  <div
                    className="admin-element-eaa60f1c4"
                    data-node-id="2521:43822"
                    data-name="shield-check"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgShieldCheck1} />
                  </div>
                  <div
                    className="admin-element-b8d938929"
                    data-node-id="2521:43824"
                    data-name="Guidance"
                  >
                    <p
                      className="admin-element-fc65763f1"
                      data-node-id="2521:43825"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Escrow Safeguard
                    </p>
                    <p
                      className="admin-element-5a7d6aeb8"
                      data-node-id="2521:43826"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Off-platform payments strictly void buyer protection. View Guidelines
                    </p>
                  </div>
                </div>
                <p
                  className="admin-element-300be65b8"
                  data-node-id="2521:43827"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Today · Market Escrow Session #ES-8831
                </p>
                <p
                  className="admin-element-dc733e247"
                  data-node-id="2521:43828"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Tunde Balogun · 10:14 AM
                </p>
                <LeetlogicIOsReceivedMessage className="admin-element-a28bae08e">
                  <p
                    className="admin-element-f13c8c588"
                    data-node-id="2521:43830"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >{`Good morning support. I just transferred ₦48,000 for the 100 tubers of yam to the platform account. But the seller is telling me to pay him directly via cash or he won't harvest.`}</p>
                </LeetlogicIOsReceivedMessage>
                <p
                  className="admin-element-e1a117fc5"
                  data-node-id="2521:43832"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  10:15 AM · Amaka (Support Officer)
                </p>
                <div
                  className="admin-element-5aa1b320c"
                  data-node-id="2521:43833"
                  data-name="Agent reply"
                >
                  <div
                    className="admin-element-2c53a1857"
                    data-node-id="I2521:43833;1244:488"
                    data-name="Content"
                  >
                    <div
                      className="admin-element-2af30b822"
                      data-node-id="I2521:43833;1244:492"
                      data-name="Input"
                    >
                      <p
                        className="admin-element-3bba74e23"
                        data-node-id="I2521:43833;1244:493"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        Good morning Tunde! Welcome to LeetLogic Support. Let me check your order
                        details right away.
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:43834"
                  data-name="Details"
                >
                  <div
                    className="admin-element-311e6f066"
                    data-node-id="2521:43835"
                    data-name="Status"
                  >
                    <p
                      className="admin-element-c5601f4a4"
                      data-node-id="2521:43836"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Payment is held until delivery
                    </p>
                  </div>
                  <div
                    className="admin-element-311e6f066"
                    data-node-id="2521:43837"
                    data-name="Status"
                  >
                    <p
                      className="admin-element-c5601f4a4"
                      data-node-id="2521:43838"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Do not pay off-app
                    </p>
                  </div>
                </div>
                <div className="admin-element-1ed49fa24" data-node-id="2521:43839" data-name="Card">
                  <p
                    className="admin-element-f13c8c588"
                    data-node-id="2521:43840"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Payment is held until delivery. Your funds remain securely in LeetLogic escrow
                    and will not be released to the seller until you inspect and confirm receipt of
                    the yams.
                  </p>
                </div>
                <p
                  className="admin-element-afe011ff4"
                  data-node-id="2521:43841"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ⌕ ♩ ▧ □ Internal Escalation Note · Press Enter ↵
                </p>
                <AdminControl
                  className="admin-element-2b1633058"
                  data-node-id="2521:43842"
                  data-name="Action"
                >
                  <div
                    className="admin-element-4713e3706"
                    data-node-id="I2521:43842;2521:20134"
                    data-name="Button:shadow"
                  />
                  <div
                    className="admin-element-9a39a55c2"
                    data-node-id="I2521:43842;2521:20135"
                    data-name="Container"
                  >
                    <div
                      className="admin-element-7613f5d5f"
                      data-node-id="I2521:43842;2521:20136"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-f62dcabf0">Send Reply ▷</p>
                    </div>
                  </div>
                </AdminControl>
              </div>
            </div>
            <div
              className="admin-element-62ecd7dd5"
              data-node-id="2521:43843"
              data-name="Buyer and linked order"
            >
              <div className="admin-element-14fe29945" data-node-id="2521:43844" data-name="Card">
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:43845"
                  data-name="Details"
                >
                  <div
                    className="admin-element-2e889c29a"
                    data-node-id="2521:43846"
                    data-name="Avatar"
                  >
                    <p
                      className="admin-element-d1956c10e"
                      data-node-id="2521:43847"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      TB
                    </p>
                  </div>
                  <p className="admin-element-dc457dde4" data-node-id="2521:43848">
                    Tunde Balogun
                  </p>
                </div>
                <p
                  className="admin-element-f13c8c588"
                  data-node-id="2521:43849"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Lagos Wholesale Mart
                </p>
                <div
                  className="admin-element-9a5a2656f"
                  data-node-id="2521:43850"
                  data-name="Details"
                >
                  <p
                    className="admin-element-af271dfad"
                    data-node-id="2521:43851"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Completed Trades
                  </p>
                  <p
                    className="admin-element-855ea3bcb"
                    data-node-id="2521:43852"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    14
                  </p>
                </div>
                <div
                  className="admin-element-9a5a2656f"
                  data-node-id="2521:43853"
                  data-name="Details"
                >
                  <p
                    className="admin-element-af271dfad"
                    data-node-id="2521:43854"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Buyer Rating
                  </p>
                  <p
                    className="admin-element-855ea3bcb"
                    data-node-id="2521:43855"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    5.0 ☆
                  </p>
                </div>
                <p
                  className="admin-element-f13c8c588"
                  data-node-id="2521:43856"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Member Since: March 2024
                </p>
                <p
                  className="admin-element-bf3e24f3a"
                  data-node-id="2521:43857"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Dispute Rate: 0.0% (Clean Record)
                </p>
                <p
                  className="admin-element-f13c8c588"
                  data-node-id="2521:43858"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Default Destination: Mile 12, Lagos
                </p>
              </div>
              <div className="admin-element-14fe29945" data-node-id="2521:43859" data-name="Card">
                <p className="admin-element-eed6922e9" data-node-id="2521:43860">
                  Order #LL-9014
                </p>
                <div
                  className="admin-element-392f38cb7"
                  data-node-id="2521:43861"
                  data-name="Status"
                >
                  <p
                    className="admin-element-1b81774f5"
                    data-node-id="2521:43862"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Escrow Active
                  </p>
                </div>
                <div
                  className="admin-element-0f896c36f"
                  data-node-id="2521:43863"
                  data-name="Notice"
                >
                  <div
                    className="admin-element-eaa60f1c4"
                    data-node-id="2521:43864"
                    data-name="sprout"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgSprout} />
                  </div>
                  <div
                    className="admin-element-b8d938929"
                    data-node-id="2521:43866"
                    data-name="Guidance"
                  >
                    <p
                      className="admin-element-fc65763f1"
                      data-node-id="2521:43867"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      White Yams (Premium)
                    </p>
                    <p
                      className="admin-element-5a7d6aeb8"
                      data-node-id="2521:43868"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Quantity: 100 large tubers · ₦48,000
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-0f896c36f"
                  data-node-id="2521:43869"
                  data-name="Notice"
                >
                  <div
                    className="admin-element-eaa60f1c4"
                    data-node-id="2521:43870"
                    data-name="shield-check"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgShieldCheck} />
                  </div>
                  <div
                    className="admin-element-b8d938929"
                    data-node-id="2521:43872"
                    data-name="Guidance"
                  >
                    <p
                      className="admin-element-fc65763f1"
                      data-node-id="2521:43873"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Gabriel Terhemba (Farmer)
                    </p>
                    <p
                      className="admin-element-5a7d6aeb8"
                      data-node-id="2521:43874"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Gboko Cooperative, Benue State · Funds Locked: ₦48,000
                    </p>
                  </div>
                </div>
                <p
                  className="admin-element-9533d1ca0"
                  data-node-id="2521:43875"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Order Fulfillment Pipeline · Step 2 of 4
                </p>
                <p
                  className="admin-element-9f6776a33"
                  data-node-id="2521:43876"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Payment Vaulted → Harvest / Dispatch → Delivery OK
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
