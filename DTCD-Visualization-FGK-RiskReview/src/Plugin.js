import pluginMeta from './Plugin.Meta';
import PluginComponent from './PluginComponent.vue';

import {
  PanelPlugin,
  LogSystemAdapter,
  EventSystemAdapter,
  DataSourceSystemAdapter,
} from './../../DTCD-SDK';

export class Plugin extends PanelPlugin {

  static getRegistrationMeta() {
    return pluginMeta;
  }

  constructor (guid, selector) {
    super();

    const logSystem = new LogSystemAdapter(guid, pluginMeta.name);
    const eventSystem = new EventSystemAdapter(guid);
    const dataSourceSystem = new DataSourceSystemAdapter();

    eventSystem.registerPluginInstance(this);

    this.guid = guid;
    this.eventSystem = eventSystem;
    this.dataSourceSystem = dataSourceSystem;
    this.dataSourceSystemGUID = this.getGUID(this.getSystem('DataSourceSystem'));

    const { default: VueJS } = this.getDependence('Vue');

    const view = new VueJS({
      data: () => ({ guid, logSystem, eventSystem }),
      render: h => h(PluginComponent),
    }).$mount(selector);

    this.vueComponent = view.$children[0];
  }

  async setPluginConfig(config = {}) {
    const { dataSource } = config;
    this.dataSource = dataSource;

    this.dataSourceSystem.createDataSource(dataSource);
    this.eventSystem.subscribe(
      this.dataSourceSystemGUID,
      `${dataSource.name}-UPDATE`,
      this.guid,
      'loadData'
    );
  }

  loadData(data) {
    this.vueComponent.setDataset(data.toArray());
    this.vueComponent.render();
  }

  getPluginConfig() {
    if (this.dataSource) {
      return {
        dataSource: this.dataSource
      }
    } else return {
      dataSource: {
        type: 'OTL',
        name: 'DS-1',
        original_otl: `
          | makeresults count=1
          | eval title="Комплаенс риски",  plus=0, ost=0, cur=-60, risk=0, fact=0
          | append [ | makeresults count=1 | eval title="Производственно-технологические риски",  plus=5, ost=0, cur=-50, risk=0, fact=5 ]
          | append [ | makeresults count=1 | eval title="Финансовые риски",  plus=15, ost=0, cur=-40, risk=0, fact=15 ]
          | append [ | makeresults count=1 | eval title="Технические и ресурсные риски",  plus=20, ost=0, cur=-70, risk=0, fact=20 ]
          | append [ | makeresults count=1 | eval title="Коммерческие риски",  plus=0, ost=0, cur=-100, risk=-50, fact=-60 ]
        `
      },
    };
  }
}
