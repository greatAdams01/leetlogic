import Link from "next/link";
import { AdminControl, AdminField } from "../controls";
const assetPathPrefix = "/admin-assets";
const imgBotanicalMark = `${assetPathPrefix}/62c76.svg`;
const imgWordmark = `${assetPathPrefix}/ffb6d.svg`;
const imgAward = `${assetPathPrefix}/6dbaa.svg`;
export default function Component1901StaffLogin() {
  return (
    <div
      className="admin-element-46b9b0b12"
      data-node-id="2521:42054"
      data-name="19.01 · Staff login"
    >
      <div
        className="admin-element-4fc05b874"
        data-node-id="2521:42055"
        data-name="Approved LeetLogic artwork"
      >
        <div
          className="admin-element-f84de7678"
          data-node-id="2521:42056"
          data-name="Botanical mark"
        >
          <img alt="" className="admin-element-8faf267d3" src={imgBotanicalMark} />
        </div>
        <div className="admin-element-0cf7a046e" data-node-id="2521:42059" data-name="Wordmark">
          <img alt="" className="admin-element-8faf267d3" src={imgWordmark} />
        </div>
      </div>
      <p className="admin-element-b54544b68" data-node-id="2521:42069">
        Leetlogic Staff Portal
      </p>
      <div className="admin-element-7111b676c" data-node-id="2521:42070" data-name="Status badge">
        <p className="admin-element-505396d32" data-node-id="2521:42071">
          Restricted access · Authorized personnel only
        </p>
      </div>
      <p className="admin-element-3438756d4" data-node-id="2521:42072">
        Staff login
      </p>
      <p className="admin-element-b54544b68" data-node-id="2521:42073">
        Enter your internal operational credentials to access farmer verification, escrow, and
        dispatch systems.
      </p>
      <div className="admin-element-62f39da6b" data-node-id="2521:42074" data-name="Content group">
        <p className="admin-element-3ab21a8ea" data-node-id="2521:42075">
          Work email · SSO integrated
        </p>
        <div className="admin-element-0c819c73b" data-node-id="2521:42076" data-name="Input">
          <AdminField
            label="Work email · SSO integrated"
            initialValue="amaka.okonkwo@staff.leetlogic.ng"
          />
        </div>
      </div>
      <div className="admin-element-62f39da6b" data-node-id="2521:42077" data-name="Content group">
        <p className="admin-element-3ab21a8ea" data-node-id="2521:42078">
          Password · Reset token
        </p>
        <div className="admin-element-0c819c73b" data-node-id="2521:42079" data-name="Input">
          <AdminField label="Password · Reset token" initialValue="••••••••••••••••••••" />
        </div>
      </div>
      <div
        className="admin-element-6b673ea9e"
        data-node-id="2521:42080"
        data-name="Assurance notice"
      >
        <div
          className="admin-element-73f1ccf97"
          data-node-id="I2521:42080;1:35387"
          data-name="Round-the-clock assurance"
        >
          <div
            className="admin-element-b2a182ecf"
            data-node-id="I2521:42080;1:35388"
            data-name="award"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgAward} />
          </div>
          <p className="admin-element-b9d807948" data-node-id="I2521:42080;1:35389">
            Single sign-on protected by hardware key (FIDO2) or SMS MFA to Nigerian telco roaming.
          </p>
        </div>
      </div>
      <AdminControl
        className="admin-element-3b377d908"
        data-node-id="2521:42081"
        data-name="Action"
      >
        <div
          className="admin-element-4713e3706"
          data-node-id="I2521:42081;1:33891"
          data-name="Button:shadow"
        />
        <div
          className="admin-element-9a39a55c2"
          data-node-id="I2521:42081;1:33892"
          data-name="Container"
        >
          <div className="admin-element-a2a55dc42" data-node-id="I2521:42081;1:33893">
            <p className="admin-element-f62dcabf0">Log in →</p>
          </div>
        </div>
      </AdminControl>
      <p className="admin-element-a57208f04" data-node-id="2521:42082">
        Trouble logging in? Contact IT Security desk
      </p>
      <p className="admin-element-a57208f04" data-node-id="2521:42083">
        Leetlogic Operations v2.4 · Encrypted session · Lagos, Nigeria
      </p>
      <p className="admin-element-a57208f04" data-node-id="2521:42084">
        ● Gateway: NG-LOS-01 · TLS 1.3 strict
      </p>
    </div>
  );
}
