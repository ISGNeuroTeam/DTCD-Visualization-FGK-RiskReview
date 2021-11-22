import pluginMeta from './Plugin.Meta';
import PluginComponent from './PluginComponent.vue';

import {
  PanelPlugin,
  LogSystemAdapter,
  EventSystemAdapter,
  StorageSystemAdapter,
} from './../../DTCD-SDK';

export class Plugin extends PanelPlugin {

  #titleColName;
  #dataSource;
  #storageSystem;

  static getRegistrationMeta() {
    return pluginMeta;
  }

  constructor (guid, selector) {
    super();

    const logSystem = new LogSystemAdapter(guid, pluginMeta.name);
    const eventSystem = new EventSystemAdapter(guid);

    eventSystem.registerPluginInstance(this);
    this.#storageSystem = new StorageSystemAdapter();

    const { default: VueJS } = this.getDependence('Vue');

    const view = new VueJS({
      data: () => ({ guid, logSystem }),
      render: h => h(PluginComponent),
    }).$mount(selector);

    this.vueComponent = view.$children[0];
    this.#dataSource = '';
    this.#titleColName = '';
  }

  setPluginConfig(config = {}) {
    const { titleColName, dataSource } = config;

    if (typeof titleColName !== 'undefined') {
      this.#titleColName = titleColName;
      this.vueComponent.setTitleColName(titleColName);
    }

    if (typeof dataSource !== 'undefined') {
      this.#dataSource = dataSource;
      const DS = this.getSystem('DataSourceSystem').getDataSource(this.#dataSource);
      if (DS.status === 'success') {
        const data = this.#storageSystem.session.getRecord(this.#dataSource);
        this.loadData(data);
      }
    }
  }

  loadData(data) {
    this.vueComponent.setDataset(data);
    this.vueComponent.render();
  }

  processDataSourceEvent(eventData) {
    const { dataSource, status } = eventData;
    this.#dataSource = dataSource;
    const data = this.#storageSystem.session.getRecord(this.#dataSource);
    this.loadData(data);
  }

  getPluginConfig() {
    const config = {};
    if (this.#dataSource) config.dataSource = this.#dataSource;
    if (this.#titleColName) config.titleColName = this.#titleColName;
    return config;
  }
}
