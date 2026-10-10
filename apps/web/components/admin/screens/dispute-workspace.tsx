import Link from "next/link";
import { AdminControl, AdminField } from "../controls";
const assetPathPrefix = "/admin-assets";
const imgBell = `${assetPathPrefix}/a9c50.svg`;
const imgUserCircle = `${assetPathPrefix}/b57bd.svg`;
const imgMapPin = `${assetPathPrefix}/d8398.svg`;
const imgChevronDown = `${assetPathPrefix}/20795.svg`;
const imgRefreshCw = `${assetPathPrefix}/6ec7b.svg`;
const imgScales02 = `${assetPathPrefix}/34c3a.svg`;
const imgUrgentTicketIndicator = `${assetPathPrefix}/747e7.svg`;
const imgAlertTriangle = `${assetPathPrefix}/3eda7.svg`;
const imgShield03 = `${assetPathPrefix}/720d9.svg`;
export default function OperationsWorkspace() {
  return (
    <div
      className="admin-element-95cbbbbdb"
      data-node-id="2521:43399"
      data-name="Operations workspace"
    >
      <div
        className="admin-element-c684b246a"
        data-node-id="2521:43400"
        data-name="Operations topbar"
      >
        <p className="admin-element-217c9dad9" data-node-id="2521:43401">
          Leetlogic Operations
        </p>
        <div className="admin-element-130fc441b" data-node-id="2521:43402" data-name="Search field">
          <AdminField
            className="admin-element-011d44306"
            data-node-id="I2521:43402;1091:63800"
            data-name="_Input field base"
            initialValue="Search trade ref, seller ID, bank tr…"
            label="Leetlogic Operations"
          />
        </div>
        <div className="admin-element-ce920da9b" data-node-id="2521:43403" data-name="Badge">
          <p className="admin-element-57567a896" data-node-id="2521:43404">
            ● System Live
          </p>
        </div>
        <div className="admin-element-ce920da9b" data-node-id="2521:43405" data-name="Badge">
          <p className="admin-element-062f6477d" data-node-id="2521:43406">
            Lagos DC: 28ms
          </p>
        </div>
        <div className="admin-element-b2a182ecf" data-node-id="2521:43407" data-name="bell">
          <img alt="" className="admin-element-8faf267d3" src={imgBell} />
        </div>
        <div className="admin-element-92d6aa1c9" data-node-id="2521:43408" data-name="Icon action">
          <div
            className="admin-element-b2a182ecf"
            data-node-id="2521:43409"
            data-name="user-circle"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgUserCircle} />
          </div>
        </div>
      </div>
      <div
        className="admin-element-255a14783"
        data-node-id="2521:43410"
        data-name="Dispute workspace"
      >
        <div
          className="admin-element-aa68627bc"
          data-node-id="2521:43411"
          data-name="Queue introduction"
        >
          <div
            className="admin-element-06dd887f8"
            data-node-id="2521:43412"
            data-name="Queue heading"
          >
            <p
              className="admin-element-57204359e"
              data-node-id="2521:43413"
            >{`Operations HQ  ›  Escrow Compliance  ›  Dispute Resolution`}</p>
            <p
              className="admin-element-2e7becf45"
              data-node-id="2521:43414"
            >{`Dispute & Resolution Queue`}</p>
            <p className="admin-element-abf54c04b" data-node-id="2521:43415">
              Manage buyer escalations, produce quality claims, and transit damages before escrow
              release.
            </p>
          </div>
          <div
            className="admin-element-c542298ac"
            data-node-id="2521:43416"
            data-name="Officer on duty"
          >
            <p className="admin-element-862dc3c4c" data-node-id="2521:43417">
              OFFICER ON DUTY
            </p>
            <p className="admin-element-74dd6562e" data-node-id="2521:43418">
              Amaka O. (Lagos)
            </p>
          </div>
          <AdminControl
            className="admin-element-5e0fe846e"
            data-node-id="2521:43419"
            data-name="Primary action"
          >
            <div
              className="admin-element-9a39a55c2"
              data-node-id="I2521:43419;2521:20145"
              data-name="Container"
            >
              <div
                className="admin-element-a47f45dc6"
                data-node-id="I2521:43419;2521:20146"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                <p className="admin-element-98fbcce75">Audit Log Export</p>
              </div>
            </div>
          </AdminControl>
        </div>
        <div
          className="admin-element-c580ee9e9"
          data-node-id="2521:43420"
          data-name="Queue metrics"
        >
          <div
            className="admin-element-c47c368cf"
            data-node-id="2521:43421"
            data-name="Queue metric"
          >
            <p className="admin-element-79e9fca46" data-node-id="2521:43422">
              All Disputes
            </p>
            <div
              className="admin-element-0a6d6cb3e"
              data-node-id="2521:43423"
              data-name="Metric value"
            >
              <p className="admin-element-1f6c8674d" data-node-id="2521:43424">
                4
              </p>
              <p className="admin-element-32a555936" data-node-id="2521:43425">
                ACTIVE
              </p>
            </div>
          </div>
          <div
            className="admin-element-c47c368cf"
            data-node-id="2521:43426"
            data-name="Queue metric"
          >
            <p className="admin-element-79e9fca46" data-node-id="2521:43427">
              Damaged Goods
            </p>
            <div
              className="admin-element-0a6d6cb3e"
              data-node-id="2521:43428"
              data-name="Metric value"
            >
              <p className="admin-element-1f6c8674d" data-node-id="2521:43429">
                2
              </p>
              <p className="admin-element-07c198bc1" data-node-id="2521:43430">
                NEEDS PHOTOS
              </p>
            </div>
          </div>
          <div
            className="admin-element-c47c368cf"
            data-node-id="2521:43431"
            data-name="Queue metric"
          >
            <p className="admin-element-79e9fca46" data-node-id="2521:43432">
              Missing Produce
            </p>
            <div
              className="admin-element-0a6d6cb3e"
              data-node-id="2521:43433"
              data-name="Metric value"
            >
              <p className="admin-element-1f6c8674d" data-node-id="2521:43434">
                1
              </p>
              <p className="admin-element-32a555936" data-node-id="2521:43435">
                Short shipment
              </p>
            </div>
          </div>
          <div
            className="admin-element-c47c368cf"
            data-node-id="2521:43436"
            data-name="Queue metric"
          >
            <p className="admin-element-79e9fca46" data-node-id="2521:43437">
              Delivery Delays
            </p>
            <div
              className="admin-element-0a6d6cb3e"
              data-node-id="2521:43438"
              data-name="Metric value"
            >
              <p className="admin-element-1f6c8674d" data-node-id="2521:43439">
                1
              </p>
              <p className="admin-element-32a555936" data-node-id="2521:43440">
                Logistics halt
              </p>
            </div>
          </div>
          <div
            className="admin-element-c47c368cf"
            data-node-id="2521:43441"
            data-name="Queue metric"
          >
            <p className="admin-element-79e9fca46" data-node-id="2521:43442">
              Resolved / Closed
            </p>
            <div
              className="admin-element-0a6d6cb3e"
              data-node-id="2521:43443"
              data-name="Metric value"
            >
              <p className="admin-element-5d84a99e6" data-node-id="2521:43444">
                18
              </p>
              <p className="admin-element-32a555936" data-node-id="2521:43445">
                SETTLED (7D)
              </p>
            </div>
          </div>
        </div>
        <div
          className="admin-element-3d1d64192"
          data-node-id="2521:43446"
          data-name="Queue filters"
        >
          <div
            className="admin-element-358abe974"
            data-node-id="2521:43447"
            data-name="Search field"
          >
            <AdminField
              className="admin-element-011d44306"
              data-node-id="I2521:43447;1091:63800"
              data-name="_Input field base"
              initialValue="Search dispute ID, buyer name, farm…"
              label="Staff input"
            />
          </div>
          <div
            className="admin-element-eac6edf38"
            data-node-id="2521:43448"
            data-name="State filter"
          >
            <div className="admin-element-58d29b27c" data-node-id="2521:43449" data-name="map-pin">
              <img alt="" className="admin-element-8faf267d3" src={imgMapPin} />
            </div>
            <p
              className="admin-element-c52893468"
              data-node-id="2521:43450"
            >{`State:  All States`}</p>
            <div
              className="admin-element-c51752dc8"
              data-node-id="2521:43451"
              data-name="chevron-down"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgChevronDown} />
            </div>
          </div>
          <div className="admin-element-b6d30eb31" data-node-id="2521:43452" data-name="Badge">
            <p
              className="admin-element-ab5af3edd"
              data-node-id="2521:43453"
            >{`● Urgent SLA (< 2 hrs remaining)`}</p>
          </div>
          <div
            className="admin-element-776862a10"
            data-node-id="2521:43454"
            data-name="Icon action"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:43455"
              data-name="refresh-cw"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgRefreshCw} />
            </div>
          </div>
        </div>
        <div
          className="admin-element-96f9c6dc4"
          data-node-id="2521:43456"
          data-name="Arbitration bench"
        >
          <div
            className="admin-element-8cac725cd"
            data-node-id="2521:43457"
            data-name="Bench heading"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:43458"
              data-name="scales-02"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgScales02} />
            </div>
            <p className="admin-element-3cbadf722" data-node-id="2521:43459">
              Arbitration Bench
            </p>
            <div className="admin-element-4053d201f" data-node-id="2521:43460" data-name="Badge">
              <p className="admin-element-a1ecd89a5" data-node-id="2521:43461">
                4 active
              </p>
            </div>
            <p className="admin-element-3f19a15ca" data-node-id="2521:43462">
              Escrow Security: Locked until manual settlement release
            </p>
          </div>
          <div
            className="admin-element-a05dd5d28"
            data-node-id="2521:43463"
            data-name="Queue table headings"
          >
            <div
              className="admin-element-fd27d6d4b"
              data-node-id="2521:43464"
              data-name="Queue column heading"
            >
              <div
                className="admin-element-97e833bbc"
                data-node-id="I2521:43464;1224:4551"
                data-name="Table header"
              >
                <p
                  className="admin-element-c97a85ab4"
                  data-node-id="I2521:43464;1224:4551;1221:106781"
                >
                  TICKET
                </p>
              </div>
            </div>
            <div
              className="admin-element-fd27d6d4b"
              data-node-id="2521:43465"
              data-name="Queue column heading"
            >
              <div
                className="admin-element-97e833bbc"
                data-node-id="I2521:43465;1224:4551"
                data-name="Table header"
              >
                <p
                  className="admin-element-c97a85ab4"
                  data-node-id="I2521:43465;1224:4551;1221:106781"
                >
                  BUYER
                </p>
              </div>
            </div>
            <div
              className="admin-element-fd27d6d4b"
              data-node-id="2521:43466"
              data-name="Queue column heading"
            >
              <div
                className="admin-element-97e833bbc"
                data-node-id="I2521:43466;1224:4551"
                data-name="Table header"
              >
                <p
                  className="admin-element-c97a85ab4"
                  data-node-id="I2521:43466;1224:4551;1221:106781"
                >{`FARMER & BATCH PRODUCE`}</p>
              </div>
            </div>
            <div
              className="admin-element-fd27d6d4b"
              data-node-id="2521:43467"
              data-name="Queue column heading"
            >
              <div
                className="admin-element-97e833bbc"
                data-node-id="I2521:43467;1224:4551"
                data-name="Table header"
              >
                <p
                  className="admin-element-c97a85ab4"
                  data-node-id="I2521:43467;1224:4551;1221:106781"
                >
                  CLAIM REASON
                </p>
              </div>
            </div>
            <div
              className="admin-element-fd27d6d4b"
              data-node-id="2521:43468"
              data-name="Queue column heading"
            >
              <div
                className="admin-element-97e833bbc"
                data-node-id="I2521:43468;1224:4551"
                data-name="Table header"
              >
                <p
                  className="admin-element-c97a85ab4"
                  data-node-id="I2521:43468;1224:4551;1221:106781"
                >
                  ESCROW AMOUNT
                </p>
              </div>
            </div>
            <div
              className="admin-element-fd27d6d4b"
              data-node-id="2521:43469"
              data-name="Queue column heading"
            >
              <div
                className="admin-element-97e833bbc"
                data-node-id="I2521:43469;1224:4551"
                data-name="Table header"
              >
                <p
                  className="admin-element-c97a85ab4"
                  data-node-id="I2521:43469;1224:4551;1221:106781"
                >
                  SUBMITTED
                </p>
              </div>
            </div>
            <div
              className="admin-element-fd27d6d4b"
              data-node-id="2521:43470"
              data-name="Queue column heading"
            >
              <div
                className="admin-element-97e833bbc"
                data-node-id="I2521:43470;1224:4551"
                data-name="Table header"
              >
                <p
                  className="admin-element-c97a85ab4"
                  data-node-id="I2521:43470;1224:4551;1221:106781"
                >
                  SLA DEADLINE
                </p>
              </div>
            </div>
            <div
              className="admin-element-fd27d6d4b"
              data-node-id="2521:43471"
              data-name="Queue column heading"
            >
              <div
                className="admin-element-97e833bbc"
                data-node-id="I2521:43471;1224:4551"
                data-name="Table header"
              >
                <p
                  className="admin-element-c97a85ab4"
                  data-node-id="I2521:43471;1224:4551;1221:106781"
                >
                  STATUS
                </p>
              </div>
            </div>
          </div>
          <div
            className="admin-element-91f05b5c2"
            data-node-id="2521:43472"
            data-name="Staff dispute queue row"
          >
            <div
              className="admin-element-149c14325"
              data-node-id="2521:43473"
              data-name="Ticket row"
            >
              <div
                className="admin-element-704252aea"
                data-node-id="I2521:43473;1227:121350"
                data-name="Content"
              >
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43473;1227:121351"
                  data-name="Column"
                >
                  <div
                    className="admin-element-6ead3a8a3"
                    data-node-id="I2521:43473;1227:121354"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43473;1227:121354;1223:41"
                    >
                      <p className="admin-element-133654a79">#2041</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-46ce1c0cb">Interstate</p>
                      <p className="admin-element-57c943547">transit</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43473;1227:121439"
                  data-name="Column"
                >
                  <div
                    className="admin-element-6ead3a8a3"
                    data-node-id="I2521:43473;1227:121442"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43473;1227:121442;1223:41"
                    >
                      <p className="admin-element-e8ba7d3b2">Tunde Bakare</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-46ce1c0cb">Victoria Island, Lagos</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-57c943547">Verified Buyer</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43473;1227:121373"
                  data-name="Column"
                >
                  <div
                    className="admin-element-6ead3a8a3"
                    data-node-id="I2521:43473;1227:121376"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43473;1227:121376;1223:41"
                    >
                      <p className="admin-element-e8ba7d3b2">Chibuzor Simon</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-46ce1c0cb">Abakaliki, Ebonyi</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-46ce1c0cb">Fresh Roma Tomatoes</p>
                      <p className="admin-element-57c943547">(4 baskets)</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43473;1227:123145"
                  data-name="Column"
                >
                  <div
                    className="admin-element-6ead3a8a3"
                    data-node-id="I2521:43473;1227:123148"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43473;1227:123148;1223:41"
                    >
                      <p className="admin-element-e8ba7d3b2">
                        “Damaged tomatoes — 2 baskets crushed in transit during interstate
                        logistics”
                      </p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-57c943547">3 proof photos attached</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43473;1227:121395"
                  data-name="Column"
                >
                  <div
                    className="admin-element-6ead3a8a3"
                    data-node-id="I2521:43473;1227:121398"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43473;1227:121398;1223:41"
                    >
                      <p className="admin-element-fdb0a3e43">₦35,600</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-57c943547">ESCROW HELD</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43473;1227:121461"
                  data-name="Column"
                >
                  <div
                    className="admin-element-6ead3a8a3"
                    data-node-id="I2521:43473;1227:121464"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43473;1227:121464;1223:41"
                    >
                      <p className="admin-element-e8ba7d3b2">Today,</p>
                      <p className="admin-element-e8ba7d3b2">11:42 AM</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-57c943547">1 hr ago</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43473;1227:121483"
                  data-name="Column"
                >
                  <div
                    className="admin-element-6ead3a8a3"
                    data-node-id="I2521:43473;1227:121486"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-e300522be"
                      data-node-id="I2521:43473;1227:121486;1223:41"
                    >
                      <p className="admin-element-dfddab0f4">48 mins remaining</p>
                      <p className="admin-element-dfddab0f4">​</p>
                      <p className="admin-element-f289274a8">Standard 4h window</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43473;1227:121505"
                  data-name="Column"
                >
                  <div
                    className="admin-element-6ead3a8a3"
                    data-node-id="I2521:43473;1227:121508"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-1771f86dd"
                      data-node-id="I2521:43473;1227:121508;1223:41"
                    >
                      <p className="admin-element-dfddab0f4">Status</p>
                      <p className="admin-element-f289274a8">Open</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="admin-element-66f813982"
              data-node-id="2521:43474"
              data-name="Urgent ticket indicator"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgUrgentTicketIndicator} />
            </div>
          </div>
          <div
            className="admin-element-435987ed6"
            data-node-id="2521:43475"
            data-name="Staff dispute queue row"
          >
            <div
              className="admin-element-ff6a96450"
              data-node-id="2521:43476"
              data-name="Ticket row"
            >
              <div
                className="admin-element-704252aea"
                data-node-id="I2521:43476;1227:121350"
                data-name="Content"
              >
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43476;1227:121351"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43476;1227:121354"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43476;1227:121354;1223:41"
                    >
                      <p className="admin-element-133654a79">#2038</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-46ce1c0cb">Weight</p>
                      <p className="admin-element-57c943547">dispute</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43476;1227:121439"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43476;1227:121442"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43476;1227:121442;1223:41"
                    >
                      <p className="admin-element-e8ba7d3b2">Ngozi Nwosu</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-57c943547">Enugu</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43476;1227:121373"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43476;1227:121376"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43476;1227:121376;1223:41"
                    >
                      <p className="admin-element-e8ba7d3b2">Segun Adeleke</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-46ce1c0cb">Oyo</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-46ce1c0cb">Cassava Tubers</p>
                      <p className="admin-element-57c943547">(15 bags)</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43476;1227:123145"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43476;1227:123148"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43476;1227:123148;1223:41"
                    >
                      <p className="admin-element-e8ba7d3b2">
                        Shortage — received 14 bags instead of 15
                      </p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-57c943547">Waybill signature recorded</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43476;1227:121395"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43476;1227:121398"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43476;1227:121398;1223:41"
                    >
                      <p className="admin-element-133654a79">₦92,000</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-57c943547">Escrow Frozen</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43476;1227:121461"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43476;1227:121464"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43476;1227:121464;1223:41"
                    >
                      <p className="admin-element-e8ba7d3b2">Yesterday,</p>
                      <p className="admin-element-e8ba7d3b2">16:30</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-57c943547">19 hrs elapsed</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43476;1227:121483"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43476;1227:121486"
                    data-name="Table cell"
                  >
                    <p
                      className="admin-element-58c4fc9b0"
                      data-node-id="I2521:43476;1227:121486;1223:41"
                    >
                      3h remaining
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43476;1227:121505"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43476;1227:121508"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-1771f86dd"
                      data-node-id="I2521:43476;1227:121508;1223:41"
                    >
                      <p className="admin-element-dfddab0f4">Status</p>
                      <p className="admin-element-dfddab0f4">Under</p>
                      <p className="admin-element-f289274a8">Revi…</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            className="admin-element-435987ed6"
            data-node-id="2521:43477"
            data-name="Staff dispute queue row"
          >
            <div
              className="admin-element-ff6a96450"
              data-node-id="2521:43478"
              data-name="Ticket row"
            >
              <div
                className="admin-element-704252aea"
                data-node-id="I2521:43478;1227:121350"
                data-name="Content"
              >
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43478;1227:121351"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43478;1227:121354"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43478;1227:121354;1223:41"
                    >
                      <p className="admin-element-133654a79">#2032</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-46ce1c0cb">Cold chain /</p>
                      <p className="admin-element-57c943547">wilting</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43478;1227:121439"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43478;1227:121442"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43478;1227:121442;1223:41"
                    >
                      <p className="admin-element-e8ba7d3b2">Alh. Garba Haruna</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-57c943547">Kano</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43478;1227:121373"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43478;1227:121376"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43478;1227:121376;1223:41"
                    >
                      <p className="admin-element-e8ba7d3b2">Amina Bello</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-46ce1c0cb">Kano</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-46ce1c0cb">Habanero Peppers</p>
                      <p className="admin-element-57c943547">(10 sacks)</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43478;1227:123145"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43478;1227:123148"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43478;1227:123148;1223:41"
                    >
                      <p className="admin-element-e8ba7d3b2">
                        Late arrival — produce wilting due to 18h truck breakdown
                      </p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-57c943547">Carrier logistics report flagged</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43478;1227:121395"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43478;1227:121398"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43478;1227:121398;1223:41"
                    >
                      <p className="admin-element-133654a79">₦48,000</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-57c943547">Escrow Frozen</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43478;1227:121461"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43478;1227:121464"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43478;1227:121464;1223:41"
                    >
                      <p className="admin-element-e8ba7d3b2">Yesterday,</p>
                      <p className="admin-element-e8ba7d3b2">09:15</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-57c943547">26 hrs elapsed</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43478;1227:121483"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43478;1227:121486"
                    data-name="Table cell"
                  >
                    <p
                      className="admin-element-58c4fc9b0"
                      data-node-id="I2521:43478;1227:121486;1223:41"
                    >
                      Extended
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43478;1227:121505"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43478;1227:121508"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-1771f86dd"
                      data-node-id="I2521:43478;1227:121508;1223:41"
                    >
                      <p className="admin-element-dfddab0f4">Status</p>
                      <p className="admin-element-dfddab0f4">Awaiting</p>
                      <p className="admin-element-dfddab0f4">Farmer</p>
                      <p className="admin-element-f289274a8">Res…</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            className="admin-element-435987ed6"
            data-node-id="2521:43479"
            data-name="Staff dispute queue row"
          >
            <div
              className="admin-element-ff6a96450"
              data-node-id="2521:43480"
              data-name="Ticket row"
            >
              <div
                className="admin-element-704252aea"
                data-node-id="I2521:43480;1227:121350"
                data-name="Content"
              >
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43480;1227:121351"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43480;1227:121354"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43480;1227:121354;1223:41"
                    >
                      <p className="admin-element-133654a79">#2029</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-46ce1c0cb">Grade</p>
                      <p className="admin-element-57c943547">verification</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43480;1227:121439"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43480;1227:121442"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43480;1227:121442;1223:41"
                    >
                      <p className="admin-element-e8ba7d3b2">Chioma Eze</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-57c943547">Port Harcourt</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43480;1227:121373"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43480;1227:121376"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43480;1227:121376;1223:41"
                    >
                      <p className="admin-element-e8ba7d3b2">Ibrahim Musa</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-46ce1c0cb">Kaduna</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-46ce1c0cb">Onions</p>
                      <p className="admin-element-57c943547">(50kg bag)</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43480;1227:123145"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43480;1227:123148"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43480;1227:123148;1223:41"
                    >
                      <p className="admin-element-e8ba7d3b2">Wrong grade delivered</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-57c943547">
                        Requested Grade A — sent Grade C small bulb
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43480;1227:121395"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43480;1227:121398"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43480;1227:121398;1223:41"
                    >
                      <p className="admin-element-133654a79">₦28,000</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-57c943547">Escrow Frozen</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43480;1227:121461"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43480;1227:121464"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-9890bf18a"
                      data-node-id="I2521:43480;1227:121464;1223:41"
                    >
                      <p className="admin-element-e8ba7d3b2">2 days ago</p>
                      <p className="admin-element-e60f8ca68">​</p>
                      <p className="admin-element-57c943547">Inspection hold</p>
                    </div>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43480;1227:121483"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43480;1227:121486"
                    data-name="Table cell"
                  >
                    <p
                      className="admin-element-58c4fc9b0"
                      data-node-id="I2521:43480;1227:121486;1223:41"
                    >
                      Standard Queue
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-95773e0af"
                  data-node-id="I2521:43480;1227:121505"
                  data-name="Column"
                >
                  <div
                    className="admin-element-8a6df7f1d"
                    data-node-id="I2521:43480;1227:121508"
                    data-name="Table cell"
                  >
                    <div
                      className="admin-element-1771f86dd"
                      data-node-id="I2521:43480;1227:121508;1223:41"
                    >
                      <p className="admin-element-dfddab0f4">Status</p>
                      <p className="admin-element-f289274a8">Open</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            className="admin-element-438f4284a"
            data-node-id="2521:43481"
            data-name="Immediate actions panel"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:43482"
              data-name="alert-triangle"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgAlertTriangle} />
            </div>
            <p className="admin-element-df07905e0" data-node-id="2521:43483">
              Immediate Action Required on #2041:
            </p>
            <p className="admin-element-3188994be" data-node-id="2521:43484">
              Tomatoes perishable within 12 hours. Re-routing or partial refund payout suggested.
            </p>
            <div
              className="admin-element-6fb77566c"
              data-node-id="2521:43485"
              data-name="Contact transporter"
            >
              <p className="admin-element-608ab0c00" data-node-id="2521:43486">
                Contact Transporter
              </p>
            </div>
            <AdminControl
              className="admin-element-4db0deff7"
              data-node-id="2521:43487"
              data-name="Primary action"
            >
              <div
                className="admin-element-9a39a55c2"
                data-node-id="I2521:43487;2521:20145"
                data-name="Container"
              >
                <div
                  className="admin-element-a47f45dc6"
                  data-node-id="I2521:43487;2521:20146"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  <p className="admin-element-98fbcce75">Issue 50% Partial Release</p>
                </div>
              </div>
            </AdminControl>
          </div>
        </div>
        <div
          className="admin-element-e07384787"
          data-node-id="2521:43488"
          data-name="Arbitration policy cards"
        >
          <div
            className="admin-element-28b09bde8"
            data-node-id="2521:43489"
            data-name="Dispute SLA card"
          >
            <div
              className="admin-element-8da3d0308"
              data-node-id="2521:43490"
              data-name="SLA policy"
            >
              <div
                className="admin-element-241af3d69"
                data-node-id="2521:43491"
                data-name="Icon action"
              >
                <div
                  className="admin-element-b2a182ecf"
                  data-node-id="2521:43492"
                  data-name="shield-03"
                >
                  <img alt="" className="admin-element-8faf267d3" src={imgShield03} />
                </div>
              </div>
              <div
                className="admin-element-cba405628"
                data-node-id="2521:43493"
                data-name="Policy content"
              >
                <div
                  className="admin-element-57cd0aef2"
                  data-node-id="2521:43494"
                  data-name="Policy heading"
                >
                  <p className="admin-element-14eecf668" data-node-id="2521:43495">
                    Dispute SLA Standard
                  </p>
                  <div
                    className="admin-element-aa3821b85"
                    data-node-id="2521:43496"
                    data-name="Badge"
                  >
                    <p className="admin-element-57567a896" data-node-id="2521:43497">
                      REGULATORY POLICY
                    </p>
                  </div>
                </div>
                <p className="admin-element-e3ca5162b" data-node-id="2521:43498">
                  Dispute SLA Standard: 4 hours from delivery rejection to escrow resolution.
                  ₦203,600 currently frozen across all 4 open cases. Unresolved cases auto-escalate
                  to Senior Agricultural Arbiter after 240 minutes.
                </p>
              </div>
            </div>
            <div
              className="admin-element-f1f452f29"
              data-node-id="2521:43499"
              data-name="SLA metrics"
            >
              <div
                className="admin-element-cba405628"
                data-node-id="2521:43500"
                data-name="SLA metric"
              >
                <p className="admin-element-862dc3c4c" data-node-id="2521:43501">
                  FROZEN ESCROW POOL
                </p>
                <p className="admin-element-0f069d000" data-node-id="2521:43502">
                  ₦203,600
                </p>
              </div>
              <div
                className="admin-element-cba405628"
                data-node-id="2521:43503"
                data-name="SLA metric"
              >
                <p className="admin-element-862dc3c4c" data-node-id="2521:43504">
                  RESOLUTION SUCCESS
                </p>
                <p className="admin-element-57f0f1b89" data-node-id="2521:43505">
                  94.2%
                </p>
              </div>
              <div
                className="admin-element-cba405628"
                data-node-id="2521:43506"
                data-name="SLA metric"
              >
                <p className="admin-element-862dc3c4c" data-node-id="2521:43507">
                  AVG TURNAROUND
                </p>
                <p className="admin-element-0f069d000" data-node-id="2521:43508">
                  2h 14m
                </p>
              </div>
            </div>
          </div>
          <div
            className="admin-element-6dddf1630"
            data-node-id="2521:43509"
            data-name="Arbitration playbook"
          >
            <p className="admin-element-f0f019f4b" data-node-id="2521:43510">
              Arbitration Playbook
            </p>
            <div
              className="admin-element-5d457794a"
              data-node-id="2521:43511"
              data-name="Playbook instruction"
            >
              <p className="admin-element-5f816e8e8" data-node-id="2521:43512">
                01.
              </p>
              <p className="admin-element-657b29d06" data-node-id="2521:43513">
                Verify dispatch waybill receipt against buyer photographic evidence.
              </p>
            </div>
            <div
              className="admin-element-5d457794a"
              data-node-id="2521:43514"
              data-name="Playbook instruction"
            >
              <p className="admin-element-5f816e8e8" data-node-id="2521:43515">
                02.
              </p>
              <p className="admin-element-657b29d06" data-node-id="2521:43516">
                Engage 3rd-party logistics aggregator for transit loss liabilities.
              </p>
            </div>
            <div
              className="admin-element-5d457794a"
              data-node-id="2521:43517"
              data-name="Playbook instruction"
            >
              <p className="admin-element-5f816e8e8" data-node-id="2521:43518">
                03.
              </p>
              <p className="admin-element-657b29d06" data-node-id="2521:43519">
                Execute split settlement: Release fair produce value to farmer, balance to buyer.
              </p>
            </div>
            <p className="admin-element-32edbc5f0" data-node-id="2521:43520">
              Read full Nigerian Agro-Escrow terms
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
