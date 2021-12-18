import pluginMeta from './Plugin.Meta';
import PluginComponent from './PluginComponent.vue';
import defaultBarParts from './utils/defaultBarParts';

import {
  PanelPlugin,
  LogSystemAdapter,
  EventSystemAdapter,
  StorageSystemAdapter,
  DataSourceSystemAdapter,
} from './../../DTCD-SDK';

export class Plugin extends PanelPlugin {
  #titleColName;
  #barParts;
  #dataSourceName;
  #storageSystem;
  #guid;
  #eventSystem;
  #dataSourceSystem;
  #dataSourceSystemGUID;

  static getRegistrationMeta() {
    return pluginMeta;
  }

  constructor(guid, selector) {
    super();

    const logSystem = new LogSystemAdapter(guid, pluginMeta.name);
    const eventSystem = new EventSystemAdapter(guid);

    eventSystem.registerPluginInstance(this);
    this.#guid = guid;
    this.#eventSystem = eventSystem;
    this.#storageSystem = new StorageSystemAdapter();
    this.#dataSourceSystem = new DataSourceSystemAdapter();
    this.#dataSourceSystemGUID = this.getGUID(this.getSystem('DataSourceSystem'));

    const { default: VueJS } = this.getDependence('Vue');

    const view = new VueJS({
      data: () => ({ guid, logSystem }),
      render: h => h(PluginComponent),
    }).$mount(selector);

    this.vueComponent = view.$children[0];
    this.#dataSourceName = '';
    this.#titleColName = '';
    this.#barParts = defaultBarParts;
  }

  loadData(data) {
    this.vueComponent.setDataset(data);
    this.vueComponent.render();
  }

  processDataSourceEvent(eventData) {
    const { dataSource, status } = eventData;
    this.#dataSourceName = dataSource;
    const data = this.#storageSystem.session.getRecord(this.#dataSourceName);
    this.loadData(data);
  }

  setPluginConfig(config = {}) {
    const { titleColName, dataSource, barParts } = config;

    if (typeof titleColName !== 'undefined') {
      this.#titleColName = titleColName;
      this.vueComponent.setTitleColName(titleColName);
    }

    if (typeof barParts !== 'undefined') {
      this.#barParts = barParts;
      this.vueComponent.setBarParts(barParts);
    }

    if (typeof dataSource !== 'undefined') {
      if (this.#dataSourceName) {
        this.#eventSystem.unsubscribe(
          this.#dataSourceSystemGUID,
          'DataSourceStatusUpdate',
          this.#guid,
          'processDataSourceEvent',
          { dataSource: this.#dataSourceName, status: 'success' }
        );
      }

      this.#dataSourceName = dataSource;

      this.#eventSystem.subscribe(
        this.#dataSourceSystemGUID,
        'DataSourceStatusUpdate',
        this.#guid,
        'processDataSourceEvent',
        { dataSource, status: 'success' }
      );

      const DS = this.#dataSourceSystem.getDataSource(this.#dataSourceName);
      if (DS.status === 'success') {
        const data = this.#storageSystem.session.getRecord(this.#dataSourceName);
        this.loadData(data);
      }
    }
  }

  getPluginConfig() {
    const config = {};
    if (this.#dataSourceName) config.dataSource = this.#dataSourceName;
    if (this.#titleColName) config.titleColName = this.#titleColName;
    if (this.#barParts) config.barParts = this.#barParts;
    return config;
  }

  setFormSettings(config) {
    this.setPluginConfig(config);
  }

  getFormSettings() {
    return {
      fields: [
        {
          component: 'title',
          propValue: 'Общие настройки',
        },
        {
          component: 'text',
          propName: 'titleColName',
          attrs: {
            label: 'Имя колонки с заголовками',
            propValue: 'title',
            required: true,
          },
        },
        {
          component: 'title',
          propValue: 'Источник данных',
        },
        {
          component: 'datasource',
          propName: 'dataSource',
          attrs: {
            label: 'Выберите источник данных',
            placeholder: 'Выберите значение',
            required: true,
          },
        },
      ],
    };
  }
}
