import Link from "next/link";
import { AdminControl, AdminField } from "../controls";
const assetPathPrefix = "/admin-assets";
const imgSelectedCheckmark = `${assetPathPrefix}/b2672.svg`;
const imgEnvato = `${assetPathPrefix}/9c242.svg`;
const imgPreservedPhotograph = `${assetPathPrefix}/dc831.png`;
const imgUser = `${assetPathPrefix}/21bb1.svg`;
const imgIcon = `${assetPathPrefix}/55d2b.svg`;
const imgLayoutAlt01 = `${assetPathPrefix}/4fdf3.svg`;
const imgIcon1 = `${assetPathPrefix}/12e32.svg`;
const imgArchive = `${assetPathPrefix}/874f4.svg`;
const imgIcon2 = `${assetPathPrefix}/af429.svg`;
const imgUsers = `${assetPathPrefix}/2aab5.svg`;
const imgServer = `${assetPathPrefix}/85cda.svg`;
const imgBookOpen = `${assetPathPrefix}/9dde3.svg`;
const imgClockRewind = `${assetPathPrefix}/25bcf.svg`;
const imgSettings = `${assetPathPrefix}/961df.svg`;
const imgLock = `${assetPathPrefix}/231e0.svg`;
const imgVector = `${assetPathPrefix}/e6877.svg`;
const imgBell = `${assetPathPrefix}/182b5.svg`;
const imgHelpCircle = `${assetPathPrefix}/8ed5b.svg`;
const imgUser1 = `${assetPathPrefix}/226cd.svg`;
const imgWallet03 = `${assetPathPrefix}/da515.svg`;
const imgFileText = `${assetPathPrefix}/d12b3.svg`;
const imgList = `${assetPathPrefix}/2d298.svg`;
const imgDotpoints02 = `${assetPathPrefix}/7a400.svg`;
const imgLink = `${assetPathPrefix}/203c4.svg`;
const imgImage = `${assetPathPrefix}/d7972.svg`;
const imgFlipBackward = `${assetPathPrefix}/95197.svg`;
const imgReverseRight = `${assetPathPrefix}/60ef7.svg`;
const imgClock = `${assetPathPrefix}/73615.svg`;
const imgPencilLine = `${assetPathPrefix}/2499f.svg`;
type LeetlogicIOsSelectableFilterChipProps = {
  className?: string;
  label?: string;
  state?: "Active" | "Passive";
};
function LeetlogicIOsSelectableFilterChip({
  className,
  label = "Active",
  state = "Active",
}: LeetlogicIOsSelectableFilterChipProps) {
  const isActive = state === "Active";
  const isPassive = state === "Passive";
  return (
    <AdminControl
      className={
        className ||
        `admin-element-56d772759 ${isPassive ? "admin-element-bfb7f249f" : "admin-element-84cd9c89c"}`
      }
      data-name="Filter chip"
    >
      {isActive && (
        <>
          <div
            className="admin-element-f23e39f62"
            data-node-id="2521:20783"
            data-name="Selected checkmark"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgSelectedCheckmark} />
          </div>
          <p
            className="admin-element-d48a49448"
            data-node-id="2521:20785"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >
            {label}
          </p>
        </>
      )}
      {isPassive && (
        <p
          className="admin-element-ffdc6facd"
          data-node-id="2521:20787"
          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
        >
          {label}
        </p>
      )}
    </AdminControl>
  );
}
function Envato({ className }: { className?: string }) {
  return (
    <div
      className={className || "admin-element-738acb643"}
      data-node-id="2117:89456"
      data-name="envato"
    >
      <img alt="" className="admin-element-8faf267d3" src={imgEnvato} />
    </div>
  );
}
export default function Component2106FaqAdmin() {
  return (
    <div
      className="admin-element-ed8971f7b"
      data-node-id="2521:43877"
      data-name="21.06 · Faq admin"
    >
      <div className="admin-element-eb6a2fd04" data-node-id="2521:43878" data-name="Staff sidebar">
        <div className="admin-element-2b497594b" data-node-id="2521:43879" data-name="Brand">
          <p className="admin-element-9a5cecca4" data-node-id="2521:43880">
            Leetlogic
          </p>
          <p className="admin-element-4f422aa6e" data-node-id="2521:43881">
            OPERATIONS
          </p>
        </div>
        <div
          className="admin-element-88b19ccdc"
          data-node-id="2521:43882"
          data-name="Staff identity"
        >
          <div className="admin-element-35368e319" data-node-id="2521:43883" data-name="user">
            <img alt="" className="admin-element-8faf267d3" src={imgUser} />
          </div>
          <div
            className="admin-element-2de30f1cb"
            data-node-id="2521:43884"
            data-name="Staff details"
          >
            <p className="admin-element-2755b416e" data-node-id="2521:43885">
              Amaka
            </p>
            <p className="admin-element-33df38077" data-node-id="2521:43886">
              Operations Admin
            </p>
          </div>
          <div className="admin-element-35368e319" data-node-id="2521:43887" data-name="Icon">
            <img alt="" className="admin-element-8faf267d3" src={imgIcon} />
          </div>
        </div>
        <div
          className="admin-element-6c094e80e"
          data-node-id="2521:43888"
          data-name="Staff navigation"
        >
          <div
            className="admin-element-6c230f485"
            data-node-id="2521:43889"
            data-name="Navigation item"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:43890"
              data-name="layout-alt-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutAlt01} />
            </div>
            <Link
              className="admin-element-3e65066e4"
              data-node-id="2521:43891"
              href="/admin/dashboard"
            >
              Dashboard
            </Link>
          </div>
          <div
            className="admin-element-6c230f485"
            data-node-id="2521:43892"
            data-name="Navigation item"
          >
            <div className="admin-element-35368e319" data-node-id="2521:43893" data-name="Icon">
              <img alt="" className="admin-element-8faf267d3" src={imgIcon1} />
            </div>
            <Link
              className="admin-element-3e65066e4"
              data-node-id="2521:43894"
              href="/admin/verification"
            >
              Verification Queue
            </Link>
          </div>
          <div
            className="admin-element-6c230f485"
            data-node-id="2521:43895"
            data-name="Navigation item"
          >
            <div className="admin-element-35368e319" data-node-id="2521:43896" data-name="archive">
              <img alt="" className="admin-element-8faf267d3" src={imgArchive} />
            </div>
            <Link
              className="admin-element-3e65066e4"
              data-node-id="2521:43897"
              href="/admin/listings"
            >
              Listings
            </Link>
          </div>
          <Link
            className="admin-element-6c230f485"
            data-node-id="2521:43898"
            data-name="Navigation item"
            href="/admin/orders"
          >
            <div className="admin-element-35368e319" data-node-id="2521:43899" data-name="Icon">
              <img alt="" className="admin-element-8faf267d3" src={imgIcon2} />
            </div>
            <span className="admin-element-3e65066e4" data-node-id="2521:43900">
              Orders
            </span>
          </Link>
          <div
            className="admin-element-6c230f485"
            data-node-id="2521:43901"
            data-name="Navigation item"
          >
            <div className="admin-element-35368e319" data-node-id="2521:43902" data-name="users">
              <img alt="" className="admin-element-8faf267d3" src={imgUsers} />
            </div>
            <Link className="admin-element-3e65066e4" data-node-id="2521:43903" href="/admin/users">
              Users
            </Link>
          </div>
          <div
            className="admin-element-6c230f485"
            data-node-id="2521:43904"
            data-name="Navigation item"
          >
            <div className="admin-element-35368e319" data-node-id="2521:43905" data-name="server">
              <img alt="" className="admin-element-8faf267d3" src={imgServer} />
            </div>
            <Link
              className="admin-element-3e65066e4"
              data-node-id="2521:43906"
              href="/admin/system"
            >
              System Status
            </Link>
          </div>
          <div
            className="admin-element-6c230f485"
            data-node-id="2521:43907"
            data-name="Navigation item"
          >
            <div className="admin-element-35368e319" data-node-id="2521:43908" data-name="Icon">
              <img alt="" className="admin-element-8faf267d3" src={imgIcon} />
            </div>
            <Link className="admin-element-3e65066e4" data-node-id="2521:43909" href="/admin/roles">
              Roles
            </Link>
          </div>
          <Link
            className="admin-element-0f9e104ce"
            data-node-id="2521:43910"
            data-name="Navigation item"
            href="/admin/faq"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:43911"
              data-name="book-open"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgBookOpen} />
            </div>
            <span
              className="admin-element-403fdc393"
              data-node-id="2521:43912"
            >{`FAQ & Content`}</span>
          </Link>
          <div
            className="admin-element-6c230f485"
            data-node-id="2521:43913"
            data-name="Navigation item"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:43914"
              data-name="clock-rewind"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgClockRewind} />
            </div>
            <Link className="admin-element-3e65066e4" data-node-id="2521:43915" href="/admin/audit">
              Audit Logs
            </Link>
          </div>
          <div
            className="admin-element-6c230f485"
            data-node-id="2521:43916"
            data-name="Navigation item"
          >
            <div className="admin-element-35368e319" data-node-id="2521:43917" data-name="settings">
              <img alt="" className="admin-element-8faf267d3" src={imgSettings} />
            </div>
            <Link
              className="admin-element-3e65066e4"
              data-node-id="2521:43918"
              href="/admin/settings"
            >
              Settings
            </Link>
          </div>
        </div>
        <div
          className="admin-element-10552d736"
          data-node-id="2521:43919"
          data-name="Sidebar spacer"
        />
        <div
          className="admin-element-b7944e898"
          data-node-id="2521:43920"
          data-name="Portal status"
        >
          <p className="admin-element-ed5726f4c" data-node-id="2521:43921">
            ● Ops Portal v2.4
          </p>
          <div className="admin-element-35368e319" data-node-id="2521:43922" data-name="lock">
            <img alt="" className="admin-element-8faf267d3" src={imgLock} />
          </div>
        </div>
      </div>
      <div
        className="admin-element-7b6f24147"
        data-node-id="2521:43923"
        data-name="Knowledge workspace"
      >
        <div
          className="admin-element-7b293e7a7"
          data-node-id="2521:43924"
          data-name="Workspace toolbar"
        >
          <div
            className="admin-element-79fd8dd29"
            data-node-id="2521:43925"
            data-name="Search entry"
          >
            <div
              className="admin-element-40ee96627"
              data-node-id="I2521:43925;2521:20162"
              data-name="SVG:margin"
            >
              <div className="admin-element-2b5059d38">
                <div
                  className="admin-element-db42f781c"
                  data-node-id="I2521:43925;2521:20163"
                  data-name="SVG"
                >
                  <div
                    className="admin-element-ffa5f14fd"
                    data-node-id="I2521:43925;2521:20164"
                    data-name="SVG"
                  >
                    <div
                      className="admin-element-a0cc0c55d"
                      data-node-id="I2521:43925;2521:20165"
                      data-name="Vector"
                    >
                      <div className="admin-element-a468e0c1b">
                        <img alt="" className="admin-element-acc3667e9" src={imgVector} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="admin-element-4a9b73a3b"
              data-node-id="I2521:43925;2521:20166"
              data-name="Container"
            >
              <div className="admin-element-4ed85d273">
                <div
                  className="admin-element-f0107f626"
                  data-node-id="I2521:43925;2521:20167"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  <p className="admin-element-76aad9ca0">
                    Search orders, farmers, commodities, or audit records...
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="admin-element-311e6f066" data-node-id="2521:43926" data-name="Badge">
            <p className="admin-element-0af801bd2" data-node-id="2521:43927">
              ● System Operational 99.98%
            </p>
          </div>
          <div className="admin-element-35368e319" data-node-id="2521:43928" data-name="bell">
            <img alt="" className="admin-element-8faf267d3" src={imgBell} />
          </div>
          <div
            className="admin-element-35368e319"
            data-node-id="2521:43929"
            data-name="help-circle"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgHelpCircle} />
          </div>
          <div className="admin-element-35368e319" data-node-id="2521:43930" data-name="user">
            <img alt="" className="admin-element-8faf267d3" src={imgUser1} />
          </div>
        </div>
        <div
          className="admin-element-d3dc68af6"
          data-node-id="2521:43931"
          data-name="Knowledge management"
        >
          <p
            className="admin-element-fc2bcd379"
            data-node-id="2521:43932"
          >{`◉ Knowledge & Support Ops`}</p>
          <p
            className="admin-element-2a46daf79"
            data-node-id="2521:43933"
          >{`Help center & FAQ management`}</p>
          <div className="admin-element-47aacf6d1" data-node-id="2521:43934" data-name="Details">
            <p className="admin-element-0c45dca73" data-node-id="2521:43935">
              Manage and publish knowledge base guides for Nigerian farmers and commercial produce
              buyers.
            </p>
            <div
              className="admin-element-da75651ff"
              data-node-id="2521:43936"
              data-name="Language selector"
            >
              <div
                className="admin-element-7c219a7f7"
                data-node-id="2521:43937"
                data-name="Editable field"
              >
                <AdminField
                  className="admin-element-011d44306"
                  data-node-id="I2521:43937;1091:63786"
                  data-name="_Input field base"
                  initialValue="English (Global) ⌄"
                  label="Manage and publish knowledge base guides for Nigerian farmers and commercial produce buyers."
                />
              </div>
            </div>
            <div
              className="admin-element-d21894f0a"
              data-node-id="2521:43938"
              data-name="New article"
            >
              <AdminControl
                className="admin-element-b24ecfc6e"
                data-node-id="2521:43939"
                data-name="Primary action"
              >
                <div
                  className="admin-element-4713e3706"
                  data-node-id="I2521:43939;2521:20134"
                  data-name="Button:shadow"
                />
                <div
                  className="admin-element-9a39a55c2"
                  data-node-id="I2521:43939;2521:20135"
                  data-name="Container"
                >
                  <div className="admin-element-1553a3b69" data-node-id="I2521:43939;2521:20136">
                    <p className="admin-element-76aad9ca0">+ New Article</p>
                  </div>
                </div>
              </AdminControl>
            </div>
          </div>
          <div
            className="admin-element-814adb519"
            data-node-id="2521:43940"
            data-name="Article list and editor"
          >
            <div
              className="admin-element-b85424dc4"
              data-node-id="2521:43941"
              data-name="Article inventory"
            >
              <div className="admin-element-c615d439e" data-node-id="2521:43942" data-name="Card">
                <div
                  className="admin-element-3054ac058"
                  data-node-id="2521:43943"
                  data-name="Search entry"
                >
                  <div
                    className="admin-element-40ee96627"
                    data-node-id="I2521:43943;2521:20162"
                    data-name="SVG:margin"
                  >
                    <div className="admin-element-2b5059d38">
                      <div
                        className="admin-element-db42f781c"
                        data-node-id="I2521:43943;2521:20163"
                        data-name="SVG"
                      >
                        <div
                          className="admin-element-ffa5f14fd"
                          data-node-id="I2521:43943;2521:20164"
                          data-name="SVG"
                        >
                          <div
                            className="admin-element-a0cc0c55d"
                            data-node-id="I2521:43943;2521:20165"
                            data-name="Vector"
                          >
                            <div className="admin-element-a468e0c1b">
                              <img alt="" className="admin-element-acc3667e9" src={imgVector} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    className="admin-element-4a9b73a3b"
                    data-node-id="I2521:43943;2521:20166"
                    data-name="Container"
                  >
                    <div className="admin-element-4ed85d273">
                      <div
                        className="admin-element-f0107f626"
                        data-node-id="I2521:43943;2521:20167"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        <p className="admin-element-76aad9ca0">
                          Filter articles by keyword or tag...
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-482f1fdf4"
                  data-node-id="2521:43944"
                  data-name="Details"
                >
                  <p className="admin-element-624a4eb9d" data-node-id="2521:43945">
                    6 Articles Listed
                  </p>
                  <p className="admin-element-944a36658" data-node-id="2521:43946">
                    ☷ Filter by Status
                  </p>
                </div>
              </div>
              <div
                className="admin-element-47aacf6d1"
                data-node-id="2521:43947"
                data-name="Details"
              >
                <div
                  className="admin-element-35368e319"
                  data-node-id="2521:43948"
                  data-name="wallet-03"
                >
                  <img alt="" className="admin-element-8faf267d3" src={imgWallet03} />
                </div>
                <p
                  className="admin-element-cd9a797d1"
                  data-node-id="2521:43949"
                >{`Payments & Escrow`}</p>
                <div
                  className="admin-element-311e6f066"
                  data-node-id="2521:43950"
                  data-name="Badge"
                >
                  <p className="admin-element-0af801bd2" data-node-id="2521:43951">
                    3
                  </p>
                </div>
              </div>
              <div className="admin-element-086fb0029" data-node-id="2521:43952" data-name="Card">
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:43953"
                  data-name="Details"
                >
                  <div
                    className="admin-element-311e6f066"
                    data-node-id="2521:43954"
                    data-name="Badge"
                  >
                    <p className="admin-element-0af801bd2" data-node-id="2521:43955">
                      ● Published
                    </p>
                  </div>
                  <div
                    className="admin-element-0fef492ee"
                    data-node-id="2521:43956"
                    data-name="Badge"
                  >
                    <p className="admin-element-b18f21651" data-node-id="2521:43957">
                      Escrow Rule
                    </p>
                  </div>
                  <p className="admin-element-c2ad5f5f7" data-node-id="2521:43958">
                    ›
                  </p>
                </div>
                <p className="admin-element-b8b8ece38" data-node-id="2521:43959">
                  When do I get paid?
                </p>
                <p className="admin-element-0cdacf191" data-node-id="2521:43960">
                  Payout timeline, escrow release upon delivery confirmation, and bank/OPay...
                </p>
                <p
                  className="admin-element-0d10cf31a"
                  data-node-id="2521:43961"
                >{`⟳ 2 hrs ago by Amaka    ◉ 1,420 views`}</p>
              </div>
              <div className="admin-element-1553a2934" data-node-id="2521:43962" data-name="Card">
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:43963"
                  data-name="Details"
                >
                  <div
                    className="admin-element-311e6f066"
                    data-node-id="2521:43964"
                    data-name="Badge"
                  >
                    <p className="admin-element-0af801bd2" data-node-id="2521:43965">
                      ● Published
                    </p>
                  </div>
                  <p className="admin-element-c2ad5f5f7" data-node-id="2521:43966">
                    ›
                  </p>
                </div>
                <p className="admin-element-79e11b5fe" data-node-id="2521:43967">
                  How escrow protects farmers
                </p>
                <p className="admin-element-0cdacf191" data-node-id="2521:43968">
                  Guaranteed deposits before trucks depart for...
                </p>
                <p
                  className="admin-element-0d10cf31a"
                  data-node-id="2521:43969"
                >{`Updated 3 days ago  ·  890 views`}</p>
              </div>
              <div className="admin-element-1553a2934" data-node-id="2521:43970" data-name="Card">
                <div
                  className="admin-element-311e6f066"
                  data-node-id="2521:43971"
                  data-name="Badge"
                >
                  <p className="admin-element-0af801bd2" data-node-id="2521:43972">
                    Draft
                  </p>
                </div>
                <p className="admin-element-b9040c0bf" data-node-id="2521:43973">
                  Withdrawal limits and transfer fees
                </p>
                <p className="admin-element-cf71073dd" data-node-id="2521:43974">
                  Tier 1 and Tier 2 account thresholds for...
                </p>
                <p
                  className="admin-element-da9d3a5c7"
                  data-node-id="2521:43975"
                >{`Edited yesterday  ·  410 views`}</p>
              </div>
              <div
                className="admin-element-47aacf6d1"
                data-node-id="2521:43976"
                data-name="Details"
              >
                <Envato className="admin-element-35368e319" />
                <p
                  className="admin-element-cd9a797d1"
                  data-node-id="2521:43978"
                >{`Listings & Produce`}</p>
                <div
                  className="admin-element-311e6f066"
                  data-node-id="2521:43979"
                  data-name="Badge"
                >
                  <p className="admin-element-0af801bd2" data-node-id="2521:43980">
                    2
                  </p>
                </div>
              </div>
              <div className="admin-element-41369ca12" data-node-id="2521:43981" data-name="Card">
                <p className="admin-element-18e6f4b2f" data-node-id="2521:43982">
                  Taking clear photos of your harvest
                </p>
                <p className="admin-element-789d7af06" data-node-id="2521:43983">
                  Natural daylight tips for yam tubers, fresh...
                </p>
                <p
                  className="admin-element-1a4e6a5f2"
                  data-node-id="2521:43984"
                >{`Updated 1 week ago  ·  2,305 views`}</p>
              </div>
              <div className="admin-element-41369ca12" data-node-id="2521:43985" data-name="Card">
                <p className="admin-element-18e6f4b2f" data-node-id="2521:43986">
                  How produce grading works
                </p>
                <p className="admin-element-789d7af06" data-node-id="2521:43987">
                  Standard moisture levels, size metrics, and qualit...
                </p>
                <p
                  className="admin-element-1a4e6a5f2"
                  data-node-id="2521:43988"
                >{`Updated 2 weeks ago  ·  1,780 views`}</p>
              </div>
              <div
                className="admin-element-47aacf6d1"
                data-node-id="2521:43989"
                data-name="Details"
              >
                <div className="admin-element-35368e319" data-node-id="2521:43990" data-name="Icon">
                  <img alt="" className="admin-element-8faf267d3" src={imgIcon2} />
                </div>
                <p
                  className="admin-element-cd9a797d1"
                  data-node-id="2521:43991"
                >{`Fulfillment & Logistics`}</p>
                <div
                  className="admin-element-311e6f066"
                  data-node-id="2521:43992"
                  data-name="Badge"
                >
                  <p className="admin-element-0af801bd2" data-node-id="2521:43993">
                    1
                  </p>
                </div>
              </div>
              <div className="admin-element-41369ca12" data-node-id="2521:43994" data-name="Card">
                <p className="admin-element-18e6f4b2f" data-node-id="2521:43995">
                  Driver pickup checklist
                </p>
                <p className="admin-element-789d7af06" data-node-id="2521:43996">
                  Waybill signatures, scale calibration, and loading...
                </p>
                <p
                  className="admin-element-1a4e6a5f2"
                  data-node-id="2521:43997"
                >{`Updated 4 days ago  ·  945 views`}</p>
              </div>
            </div>
            <div
              className="admin-element-e5b673564"
              data-node-id="2521:43998"
              data-name="Editor and localization"
            >
              <div className="admin-element-99a379084" data-node-id="2521:43999" data-name="Card">
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:44000"
                  data-name="Details"
                >
                  <div
                    className="admin-element-35368e319"
                    data-node-id="2521:44001"
                    data-name="file-text"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgFileText} />
                  </div>
                  <div
                    className="admin-element-2cccba0c3"
                    data-node-id="2521:44002"
                    data-name="Editor heading"
                  >
                    <p className="admin-element-3ab21a8ea" data-node-id="2521:44003">
                      EDITOR WORKSPACE
                    </p>
                    <div
                      className="admin-element-47aacf6d1"
                      data-node-id="2521:44004"
                      data-name="Details"
                    >
                      <p className="admin-element-64899bf07" data-node-id="2521:44005">
                        When do I get paid?
                      </p>
                      <div
                        className="admin-element-311e6f066"
                        data-node-id="2521:44006"
                        data-name="Badge"
                      >
                        <p className="admin-element-0af801bd2" data-node-id="2521:44007">
                          Live
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:44008"
                  data-name="Details"
                >
                  <p className="admin-element-c2ad5f5f7" data-node-id="2521:44009">
                    Discard
                  </p>
                  <div
                    className="admin-element-e73643cd2"
                    data-node-id="2521:44010"
                    data-name="Card"
                  >
                    <p className="admin-element-d63bbb98a" data-node-id="2521:44011">
                      ▯ Preview in App
                    </p>
                  </div>
                  <div
                    className="admin-element-b36667804"
                    data-node-id="2521:44012"
                    data-name="Publish action"
                  >
                    <AdminControl
                      className="admin-element-b24ecfc6e"
                      data-node-id="2521:44013"
                      data-name="Primary action"
                    >
                      <div
                        className="admin-element-4713e3706"
                        data-node-id="I2521:44013;2521:20134"
                        data-name="Button:shadow"
                      />
                      <div
                        className="admin-element-9a39a55c2"
                        data-node-id="I2521:44013;2521:20135"
                        data-name="Container"
                      >
                        <div
                          className="admin-element-99a836c79"
                          data-node-id="I2521:44013;2521:20136"
                        >
                          <p className="admin-element-76aad9ca0">{`Save & Publish Changes`}</p>
                        </div>
                      </div>
                    </AdminControl>
                  </div>
                </div>
                <div
                  className="admin-element-88eeeb800"
                  data-node-id="2521:44014"
                  data-name="Article fields"
                >
                  <p className="admin-element-79e11b5fe" data-node-id="2521:44015">
                    Article Title
                  </p>
                  <div
                    className="admin-element-153c0a180"
                    data-node-id="2521:44016"
                    data-name="Editable field"
                  >
                    <AdminField
                      className="admin-element-011d44306"
                      data-node-id="I2521:44016;1091:63786"
                      data-name="_Input field base"
                      initialValue="When do I get paid? 21 / 80"
                      label="Article Title"
                    />
                  </div>
                  <div
                    className="admin-element-47aacf6d1"
                    data-node-id="2521:44017"
                    data-name="Details"
                  >
                    <div
                      className="admin-element-5bccdaa1c"
                      data-node-id="2521:44018"
                      data-name="Knowledge category"
                    >
                      <p className="admin-element-82438c881" data-node-id="2521:44019">
                        Knowledge Category
                      </p>
                      <div
                        className="admin-element-153c0a180"
                        data-node-id="2521:44020"
                        data-name="Editable field"
                      >
                        <AdminField
                          className="admin-element-011d44306"
                          data-node-id="I2521:44020;1091:63786"
                          data-name="_Input field base"
                          initialValue="Payments & Payouts ⌄"
                          label="Knowledge Category"
                        />
                      </div>
                    </div>
                    <div
                      className="admin-element-3633d0170"
                      data-node-id="2521:44021"
                      data-name="Target audience"
                    >
                      <p className="admin-element-82438c881" data-node-id="2521:44022">
                        Target Audience
                      </p>
                      <div
                        className="admin-element-6e3ce650e"
                        data-node-id="2521:44023"
                        data-name="Audience options"
                      >
                        <LeetlogicIOsSelectableFilterChip
                          className="admin-element-3b644e38b"
                          label="✓ Farmers"
                        />
                        <LeetlogicIOsSelectableFilterChip
                          className="admin-element-46d84f92c"
                          label="Buyers"
                          state="Passive"
                        />
                        <LeetlogicIOsSelectableFilterChip
                          className="admin-element-46d84f92c"
                          label="Logistics Drivers"
                          state="Passive"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-20b52f4c4"
                  data-node-id="2521:44027"
                  data-name="Details"
                >
                  <p className="admin-element-1325aa8b6" data-node-id="2521:44028">
                    Article Content (Markdown Enabled)
                  </p>
                  <p className="admin-element-6596c1343" data-node-id="2521:44029">
                    Last autosaved: 1 min ago
                  </p>
                </div>
                <div
                  className="admin-element-e93b5f7ed"
                  data-node-id="2521:44030"
                  data-name="Rich article editor"
                >
                  <div
                    className="admin-element-dbce6422a"
                    data-node-id="2521:44031"
                    data-name="Formatting toolbar"
                  >
                    <p className="admin-element-d9f4c5057" data-node-id="2521:44032">
                      B
                    </p>
                    <p className="admin-element-c2ad5f5f7" data-node-id="2521:44033">
                      I
                    </p>
                    <div
                      className="admin-element-35368e319"
                      data-node-id="2521:44034"
                      data-name="list"
                    >
                      <img alt="" className="admin-element-8faf267d3" src={imgList} />
                    </div>
                    <div
                      className="admin-element-35368e319"
                      data-node-id="2521:44035"
                      data-name="dotpoints-02"
                    >
                      <img alt="" className="admin-element-8faf267d3" src={imgDotpoints02} />
                    </div>
                    <div
                      className="admin-element-35368e319"
                      data-node-id="2521:44036"
                      data-name="link"
                    >
                      <img alt="" className="admin-element-8faf267d3" src={imgLink} />
                    </div>
                    <div
                      className="admin-element-35368e319"
                      data-node-id="2521:44037"
                      data-name="image"
                    >
                      <img alt="" className="admin-element-8faf267d3" src={imgImage} />
                    </div>
                    <div
                      className="admin-element-311e6f066"
                      data-node-id="2521:44038"
                      data-name="Badge"
                    >
                      <p className="admin-element-0af801bd2" data-node-id="2521:44039">
                        ⓘ Callout
                      </p>
                    </div>
                    <div
                      className="admin-element-35368e319"
                      data-node-id="2521:44040"
                      data-name="flip-backward"
                    >
                      <img alt="" className="admin-element-8faf267d3" src={imgFlipBackward} />
                    </div>
                    <div
                      className="admin-element-35368e319"
                      data-node-id="2521:44041"
                      data-name="reverse-right"
                    >
                      <img alt="" className="admin-element-8faf267d3" src={imgReverseRight} />
                    </div>
                  </div>
                  <div
                    className="admin-element-b0db04887"
                    data-node-id="2521:44042"
                    data-name="Article content"
                  >
                    <p className="admin-element-381cb0016" data-node-id="2521:44043">
                      Payments are held safely in the Leetlogic Escrow pool as soon as the buyer
                      places an order. Once the driver delivers the produce and the buyer confirms
                      receipt (or 24 hours elapse with GPS proof of delivery), funds are released
                      instantly to your Leetlogic Wallet. You can then withdraw directly to your
                      verified commercial bank account or mobile money wallet (OPay, PalmPay) within
                      15 minutes.
                    </p>
                    <div
                      className="admin-element-601be1218"
                      data-node-id="2521:44044"
                      data-name="Card"
                    >
                      <div
                        className="admin-element-47aacf6d1"
                        data-node-id="2521:44045"
                        data-name="Details"
                      >
                        <div
                          className="admin-element-35368e319"
                          data-node-id="2521:44046"
                          data-name="clock"
                        >
                          <img alt="" className="admin-element-8faf267d3" src={imgClock} />
                        </div>
                        <p className="admin-element-dbc825532" data-node-id="2521:44047">
                          Operational Notice
                        </p>
                        <div
                          className="admin-element-35368e319"
                          data-node-id="2521:44048"
                          data-name="pencil-line"
                        >
                          <img alt="" className="admin-element-8faf267d3" src={imgPencilLine} />
                        </div>
                      </div>
                      <p className="admin-element-ed2142f35" data-node-id="2521:44049">
                        Nigerian Bank Settlement Window: 8:00 AM – 8:00 PM West Africa Time.
                      </p>
                    </div>
                    <div
                      className="admin-element-47aacf6d1"
                      data-node-id="2521:44050"
                      data-name="Details"
                    >
                      <div
                        className="admin-element-d1d2ad963"
                        data-node-id="2521:44051"
                        data-name="Card"
                      >
                        <p className="admin-element-eb00a6706" data-node-id="2521:44052">
                          Attached Verification Visual
                        </p>
                        <div
                          className="admin-element-9555e2b27"
                          data-node-id="2521:44053"
                          data-name="Source photograph"
                        >
                          <div
                            className="admin-element-a5769d33f"
                            data-node-id="2521:44054"
                            data-name="Preserved photograph"
                          >
                            <img
                              alt=""
                              className="admin-element-629627208"
                              src={imgPreservedPhotograph}
                            />
                          </div>
                        </div>
                        <p className="admin-element-eb00a6706" data-node-id="2521:44055">
                          escrow_flow.png
                        </p>
                      </div>
                      <div
                        className="admin-element-f77a2251d"
                        data-node-id="2521:44056"
                        data-name="Card"
                      >
                        <p className="admin-element-5fa95f227" data-node-id="2521:44057">
                          Related Quick Links
                        </p>
                        <p className="admin-element-510503ea2" data-node-id="2521:44058">
                          ↔ Setting up OPay settlement account
                        </p>
                        <p className="admin-element-510503ea2" data-node-id="2521:44059">
                          ↔ Resolving transit short-counts
                        </p>
                        <p className="admin-element-510503ea2" data-node-id="2521:44060">
                          ↔ Understanding Tier 2 verification
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:44061"
                  data-name="Details"
                >
                  <p className="admin-element-20d1cfadc" data-node-id="2521:44062">
                    All changes automatically backed up to central audit repository.
                  </p>
                  <p className="admin-element-c2ad5f5f7" data-node-id="2521:44063">
                    Discard
                  </p>
                  <div
                    className="admin-element-f8cf47301"
                    data-node-id="2521:44064"
                    data-name="Preview action"
                  >
                    <div
                      className="admin-element-7c219a7f7"
                      data-node-id="2521:44065"
                      data-name="Editable field"
                    >
                      <AdminField
                        className="admin-element-011d44306"
                        data-node-id="I2521:44065;1091:63786"
                        data-name="_Input field base"
                        initialValue="Preview in App"
                        label="All changes automatically backed up to central audit repository."
                      />
                    </div>
                  </div>
                  <div
                    className="admin-element-acc1ff6b3"
                    data-node-id="2521:44066"
                    data-name="Save action"
                  >
                    <AdminControl
                      className="admin-element-b24ecfc6e"
                      data-node-id="2521:44067"
                      data-name="Primary action"
                    >
                      <div
                        className="admin-element-4713e3706"
                        data-node-id="I2521:44067;2521:20134"
                        data-name="Button:shadow"
                      />
                      <div
                        className="admin-element-9a39a55c2"
                        data-node-id="I2521:44067;2521:20135"
                        data-name="Container"
                      >
                        <div
                          className="admin-element-99a836c79"
                          data-node-id="I2521:44067;2521:20136"
                        >
                          <p className="admin-element-76aad9ca0">{`Save & Publish Changes`}</p>
                        </div>
                      </div>
                    </AdminControl>
                  </div>
                </div>
              </div>
              <div className="admin-element-a98cc3994" data-node-id="2521:44068" data-name="Card">
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:44069"
                  data-name="Details"
                >
                  <p className="admin-element-cd9a797d1" data-node-id="2521:44070">
                    Regional Localization Status
                  </p>
                  <div
                    className="admin-element-311e6f066"
                    data-node-id="2521:44071"
                    data-name="Badge"
                  >
                    <p className="admin-element-0af801bd2" data-node-id="2521:44072">
                      100% Core Ready
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:44073"
                  data-name="Details"
                >
                  <div
                    className="admin-element-66f4deebd"
                    data-node-id="2521:44074"
                    data-name="Card"
                  >
                    <p className="admin-element-3ab21a8ea" data-node-id="2521:44075">
                      ● Hausa Synchronized
                    </p>
                  </div>
                  <div
                    className="admin-element-66f4deebd"
                    data-node-id="2521:44076"
                    data-name="Card"
                  >
                    <p className="admin-element-3ab21a8ea" data-node-id="2521:44077">
                      ● Yorùbá Synchronized
                    </p>
                  </div>
                  <div
                    className="admin-element-66f4deebd"
                    data-node-id="2521:44078"
                    data-name="Card"
                  >
                    <p className="admin-element-8e4baa955" data-node-id="2521:44079">
                      ● Igbo Review Pending
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
